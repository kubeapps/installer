/*
Copyright © 2021 VMware
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"plugin"
	"reflect"
	"sort"
	"strings"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	packages "github.com/kubeapps/kubeapps/cmd/kubeapps-apis/gen/core/packages/v1alpha1"
	plugins "github.com/kubeapps/kubeapps/cmd/kubeapps-apis/gen/core/plugins/v1alpha1"
	"github.com/kubeapps/kubeapps/pkg/kube"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	log "k8s.io/klog/v2"
)

// Add plugin message to proto. then include in struct here with client?
// How to create client dynamically? Perhaps return client when registering each?
// Perhaps define an interface that client must implement (based on server?)

const (
	pluginRootDir           = "/"
	grpcRegisterFunction    = "RegisterWithGRPCServer"
	gatewayRegisterFunction = "RegisterHTTPHandlerFromEndpoint"
	pluginDetailFunction    = "GetPluginDetail"
	clustersCAFilesPrefix   = "/etc/additional-clusters-cafiles"
)

var (
	pluginsServeOpts ServeOptions
	inClusterConfig  *rest.Config
)

// pkgsPluginWithServer stores the plugin detail together with its implementation.
type pkgsPluginWithServer struct {
	plugin *plugins.Plugin
	server packages.PackagesServiceServer
}

// coreServer implements the API defined in cmd/kubeapps-api-service/core/core.proto
type pluginsServer struct {
	plugins.UnimplementedPluginsServiceServer

	// The slice of plugins is initialised when registering plugins during NewPluginsServer.
	plugins []*plugins.Plugin

	// packagesPlugins contains plugin server implementations which satisfy
	// the core server packages.v1alpha1 interface.
	// TODO: Update the plugins server to be able to register different versions
	// of core plugins.
	packagesPlugins []*pkgsPluginWithServer
}

func NewPluginsServer(serveOpts ServeOptions, registrar grpc.ServiceRegistrar, gwArgs gwHandlerArgs) (*pluginsServer, error) {
	// Store the serveOptions in the global 'pluginsServeOpts' variable
	pluginsServeOpts = serveOpts

	// Find all .so plugins in the specified plugins directory.
	pluginPaths, err := listSOFiles(os.DirFS(pluginRootDir), serveOpts.PluginDirs)
	if err != nil {
		log.Fatalf("failed to check for plugins: %v", err)
	}

	ps := &pluginsServer{}

	pluginDetails, err := ps.registerPlugins(pluginPaths, registrar, gwArgs)
	if err != nil {
		return nil, fmt.Errorf("failed to register plugins: %w", err)
	}

	sortPlugins(pluginDetails)

	ps.plugins = pluginDetails

	return ps, nil
}

// sortPlugins returns a consistently ordered slice.
func sortPlugins(p []*plugins.Plugin) {
	sort.Slice(p, func(i, j int) bool {
		return p[i].Name < p[j].Name || (p[i].Name == p[j].Name && p[i].Version < p[j].Version)
	})
}

// GetConfiguredPlugins returns details for each configured plugin.
func (s *pluginsServer) GetConfiguredPlugins(ctx context.Context, in *plugins.GetConfiguredPluginsRequest) (*plugins.GetConfiguredPluginsResponse, error) {
	log.Infof("+GetConfiguredPlugins")
	return &plugins.GetConfiguredPluginsResponse{
		Plugins: s.plugins,
	}, nil
}

// registerPlugins opens each plugin, looks up the register function and calls it with the registrar.
func (s *pluginsServer) registerPlugins(pluginPaths []string, grpcReg grpc.ServiceRegistrar, gwArgs gwHandlerArgs) ([]*plugins.Plugin, error) {
	pluginDetails := []*plugins.Plugin{}
	for _, pluginPath := range pluginPaths {
		p, err := plugin.Open(pluginPath)
		if err != nil {
			return nil, fmt.Errorf("unable to open plugin %q: %w", pluginPath, err)
		}

		var pluginDetail *plugins.Plugin
		if pluginDetail, err = getPluginDetail(p, pluginPath); err != nil {
			return nil, err
		} else {
			pluginDetails = append(pluginDetails, pluginDetail)
		}

		if err = s.registerGRPC(p, pluginDetail, grpcReg); err != nil {
			return nil, err
		}

		if err = registerHTTP(p, pluginDetail, gwArgs); err != nil {
			return nil, err
		}

		log.Infof("Successfully registered plugin %q", pluginPath)
	}
	return pluginDetails, nil
}

// registerGRPC finds and calls the required function for registering the plugin for the GRPC server.
func (s *pluginsServer) registerGRPC(p *plugin.Plugin, pluginDetail *plugins.Plugin, registrar grpc.ServiceRegistrar) error {
	grpcRegFn, err := p.Lookup(grpcRegisterFunction)
	if err != nil {
		return fmt.Errorf("unable to lookup %q for %v: %w", grpcRegisterFunction, pluginDetail, err)
	}
	type grpcRegisterFunctionType = func(grpc.ServiceRegistrar, func(context.Context) (dynamic.Interface, error)) interface{}

	grpcFn, ok := grpcRegFn.(grpcRegisterFunctionType)
	if !ok {
		var dummyFn grpcRegisterFunctionType = func(grpc.ServiceRegistrar, func(context.Context) (dynamic.Interface, error)) interface{} { return nil }
		return fmt.Errorf("unable to use %q in plugin %v due to mismatched signature.\nwant: %T\ngot: %T", grpcRegisterFunction, pluginDetail, dummyFn, grpcRegFn)
	}

	server := grpcFn(registrar, dynClientGetterForContext)

	return s.registerPluginsSatisfyingCoreAPIs(server, pluginDetail)
}

// registerPluginsImplementingCoreAPIs checks a plugin implementation to see
// if it implements a core api (such as `packages.v1alpha1`) and if so,
// keeps a (typed) reference to the implementation for use on aggregate APIs.
func (s *pluginsServer) registerPluginsSatisfyingCoreAPIs(pluginSrv interface{}, pluginDetail *plugins.Plugin) error {
	// The following check if the service implements an interface is what
	// grpc-go itself does, see:
	// https://github.com/grpc/grpc-go/blob/v1.38.0/server.go#L621
	serverType := reflect.TypeOf(pluginSrv)
	corePackagesType := reflect.TypeOf((*packages.PackagesServiceServer)(nil)).Elem()

	if serverType.Implements(corePackagesType) {
		pkgsSrv, ok := pluginSrv.(packages.PackagesServiceServer)
		if !ok {
			return fmt.Errorf("Unable to convert plugin %v to core PackagesServicesServer although it implements the same.", pluginDetail)
		}
		s.packagesPlugins = append(s.packagesPlugins, &pkgsPluginWithServer{
			plugin: pluginDetail,
			server: pkgsSrv,
		})
		log.Infof("Plugin %v implements core.packages.v1alpha1. Registered for aggregation.", pluginDetail)
	}
	return nil
}

// getPluginDetail returns a core.plugins.Plugin as defined by the plugin itself.
func getPluginDetail(p *plugin.Plugin, pluginPath string) (*plugins.Plugin, error) {
	pluginDetailFn, err := p.Lookup(pluginDetailFunction)
	if err != nil {
		return nil, fmt.Errorf("unable to lookup %q for %q: %w", pluginDetailFunction, pluginPath, err)
	}

	type pluginDetailFunctionType = func() *plugins.Plugin

	fn, ok := pluginDetailFn.(pluginDetailFunctionType)
	if !ok {
		var dummyFn pluginDetailFunctionType = func() *plugins.Plugin { return &plugins.Plugin{} }
		return nil, fmt.Errorf("unable to use %q in plugin %q due to a mismatched signature. \nwant: %T\ngot: %T", pluginDetailFunction, pluginPath, dummyFn, pluginDetailFn)
	}

	return fn(), nil
}

// registerHTTP finds and calls the required function for registering the plugin for the HTTP gateway server.
func registerHTTP(p *plugin.Plugin, pluginDetail *plugins.Plugin, gwArgs gwHandlerArgs) error {
	gwRegFn, err := p.Lookup(gatewayRegisterFunction)
	if err != nil {
		return fmt.Errorf("unable to lookup %q for %v: %w", gatewayRegisterFunction, pluginDetail, err)
	}
	type gatewayRegisterFunctionType = func(context.Context, *runtime.ServeMux, string, []grpc.DialOption) error
	gwfn, ok := gwRegFn.(gatewayRegisterFunctionType)
	if !ok {
		// Create a dummyFn only so we can ensure the correct type is shown in case
		// of an error.
		var dummyFn gatewayRegisterFunctionType = func(context.Context, *runtime.ServeMux, string, []grpc.DialOption) error { return nil }
		return fmt.Errorf("unable to use %q in plugin %v due to mismatched signature.\nwant: %T\ngot: %T", gatewayRegisterFunction, pluginDetail, dummyFn, gwRegFn)
	}
	return gwfn(gwArgs.ctx, gwArgs.mux, gwArgs.addr, gwArgs.dialOptions)
}

// listSOFiles returns the absolute paths of all .so files found in any of the provided plugin directories.
//
// pluginDirs can be relative to the current directory or absolute.
func listSOFiles(fsys fs.FS, pluginDirs []string) ([]string, error) {
	matches := []string{}

	for _, pluginDir := range pluginDirs {
		if !filepath.IsAbs(pluginDir) {
			cwd, err := os.Getwd()
			if err != nil {
				return nil, err
			}
			pluginDir = filepath.Join(cwd, pluginDir)
		}
		relPluginDir, err := filepath.Rel(pluginRootDir, pluginDir)
		if err != nil {
			return nil, err
		}

		m, err := fs.Glob(fsys, path.Join(relPluginDir, "/", "*.so"))
		if err != nil {
			return nil, err
		}

		for _, match := range m {
			matches = append(matches, filepath.Join(pluginRootDir, match))
		}
	}
	return matches, nil
}

// parseClusterConfig returns a kube.ClustersConfig struct after parsing the raw `clusters` object provided by the user
// TODO(agamez): this fn is the same as in kubeapps/cmd/kubeops/main.go, export it and use it instead (unit test available at: cmd/kubeops/main_test.go)
func parseClusterConfig(configPath, caFilesPrefix string, pinnipedProxyURL string) (kube.ClustersConfig, func(), error) {
	caFilesDir, err := ioutil.TempDir(caFilesPrefix, "")
	if err != nil {
		return kube.ClustersConfig{}, func() {}, err
	}
	deferFn := func() { os.RemoveAll(caFilesDir) }
	content, err := ioutil.ReadFile(configPath)
	if err != nil {
		return kube.ClustersConfig{}, deferFn, err
	}

	var clusterConfigs []kube.ClusterConfig
	if err = json.Unmarshal(content, &clusterConfigs); err != nil {
		return kube.ClustersConfig{}, deferFn, err
	}

	configs := kube.ClustersConfig{Clusters: map[string]kube.ClusterConfig{}}
	configs.PinnipedProxyURL = pinnipedProxyURL
	for _, c := range clusterConfigs {
		// Select the cluster in which Kubeapps in installed. We look for either
		// `isKubeappsCluster: true` or an empty `APIServiceURL`.
		isKubeappsClusterCandidate := c.IsKubeappsCluster || c.APIServiceURL == ""
		if isKubeappsClusterCandidate {
			if configs.KubeappsClusterName == "" {
				configs.KubeappsClusterName = c.Name
			} else {
				return kube.ClustersConfig{}, nil, fmt.Errorf("only one cluster can be configured using either 'isKubeappsCluster: true' or without an apiServiceURL to refer to the cluster on which Kubeapps is installed, two defined: %q, %q", configs.KubeappsClusterName, c.Name)
			}
		}

		// We need to decode the base64-encoded cadata from the input.
		if c.CertificateAuthorityData != "" {
			decodedCAData, err := base64.StdEncoding.DecodeString(c.CertificateAuthorityData)
			if err != nil {
				return kube.ClustersConfig{}, deferFn, err
			}
			c.CertificateAuthorityDataDecoded = string(decodedCAData)

			// We also need a CAFile field because Helm uses the genericclioptions.ConfigFlags
			// struct which does not support CAData.
			// https://github.com/kubernetes/cli-runtime/issues/8
			c.CAFile = filepath.Join(caFilesDir, c.Name)
			err = ioutil.WriteFile(c.CAFile, decodedCAData, 0644)
			if err != nil {
				return kube.ClustersConfig{}, deferFn, err
			}
		}
		configs.Clusters[c.Name] = c
	}
	return configs, deferFn, nil
}

// dynClientGetterForContext returns a k8s client for use during interactions with the cluster.
// It is invoked by dynClientGetterForContext and unit tests passing the appropriate configuration
func dynClientGetterForContextWithConfig(ctx context.Context, inClusterConfig *rest.Config, serveOpts ServeOptions, config kube.ClustersConfig) (dynamic.Interface, error) {
	var err error
	token, err := extractToken(ctx)
	if err != nil {
		return nil, err
	}

	var client dynamic.Interface
	if !serveOpts.UnsafeUseDemoSA {
		restConfig, err := kube.NewClusterConfig(inClusterConfig, token, "default", config)
		if err != nil {
			return nil, fmt.Errorf("unable to get clusterConfig: %w", err)
		}
		client, err = dynamic.NewForConfig(restConfig)
		if err != nil {
			return nil, fmt.Errorf("unable to create dynamic client: %w", err)
		}
	} else {
		client, err = dynamic.NewForConfig(inClusterConfig)
		if err != nil {
			return nil, fmt.Errorf("unable to create dynamic client: %w", err)
		}
	}
	return client, nil
}

// dynClientGetterForContext returns a k8s client for use during interactions with the cluster.
// It utilizes the user credential from the request context. The plugins just have to call this function
// passing the context in order to retrieve the configured k8s client
func dynClientGetterForContext(ctx context.Context) (dynamic.Interface, error) {
	var err error
	inClusterConfig, err = rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("unable to get inClusterConfig: %w", err)
	}

	config, err := getClustersConfigFromServeOpts(pluginsServeOpts)
	if err != nil {
		return nil, err
	}

	return dynClientGetterForContextWithConfig(ctx, inClusterConfig, pluginsServeOpts, config)
}

// extractToken returns the token passed through the gRPC request in the "authorization" metadata
// It is equivalent to the A"uthorization" usual HTTP 1 header
// For instance: authorization="Bearer abc" will return "abc"
func extractToken(ctx context.Context) (string, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", status.Errorf(codes.Unauthenticated, "error reading request metadata/headers")
	}
	if len(md["authorization"]) > 0 {
		if strings.HasPrefix(md["authorization"][0], "Bearer ") {
			return strings.TrimPrefix(md["authorization"][0], "Bearer "), nil
		} else {
			return "", status.Errorf(codes.Unauthenticated, "malformed authorization metadata")
		}
	} else {
		// No authorization header found, no error here, we will delegate it to the RBAC
		return "", nil
	}
}

// getClustersConfigFromServeOpts get the serveOptions and calls parseClusterConfig with the proper values
// returning a kube.ClustersConfig
func getClustersConfigFromServeOpts(serveOpts ServeOptions) (kube.ClustersConfig, error) {
	var err error
	// If there is no clusters config, we default to the previous behaviour of a "default" cluster.
	config := kube.ClustersConfig{KubeappsClusterName: "default"}
	if serveOpts.ClustersConfigPath != "" {
		var cleanupCAFiles func()
		config, cleanupCAFiles, err = parseClusterConfig(serveOpts.ClustersConfigPath, clustersCAFilesPrefix, serveOpts.PinnipedProxyURL)
		if err != nil {
			return kube.ClustersConfig{}, fmt.Errorf("unable to parse additional clusters config: %+v", err)
		}
		defer cleanupCAFiles()
	}
	return config, nil
}
