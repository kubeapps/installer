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
package main

import (
	"encoding/json"
	"fmt"

	corev1 "github.com/kubeapps/kubeapps/cmd/kubeapps-apis/gen/core/packages/v1alpha1"
	"github.com/kubeapps/kubeapps/cmd/kubeapps-apis/gen/plugins/fluxv2/packages/v1alpha1"
	chart "github.com/kubeapps/kubeapps/pkg/chart/models"
	"github.com/kubeapps/kubeapps/pkg/helm"
	httpclient "github.com/kubeapps/kubeapps/pkg/http-client"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	log "k8s.io/klog/v2"
)

// calling this file utils.go until I can come up with better name or organize code differently
func prettyPrintObject(o runtime.Object) string {
	prettyBytes, err := json.MarshalIndent(o, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", o)
	}
	return string(prettyBytes)
}

func prettyPrintMap(m map[string]interface{}) string {
	prettyBytes, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", m)
	}
	return string(prettyBytes)
}

func indexOneRepo(unstructuredRepo map[string]interface{}) ([]*corev1.AvailablePackageSummary, error) {
	repo, err := newPackageRepository(unstructuredRepo)
	if err != nil {
		return nil, err
	}

	ready, err := isRepoReady(unstructuredRepo)
	if err != nil || !ready {
		return nil, status.Errorf(codes.Internal,
			"Skipping packages for repository [%s] because it is not in 'Ready' state:%v\n%s",
			repo.Name,
			err,
			prettyPrintMap(unstructuredRepo))
	}

	indexUrl, found, err := unstructured.NestedString(unstructuredRepo, "status", "url")
	if err != nil || !found {
		return nil, status.Errorf(codes.Internal,
			"expected field status.url not found on HelmRepository [%s]: %v:\n%s",
			repo.Name,
			err,
			prettyPrintMap(unstructuredRepo))
	}

	log.Infof("Found repository: [%s], index URL: [%s]", repo.Name, indexUrl)

	// no need to provide authz, userAgent or any of the TLS details, as we are reading index.yaml file from
	// local cluster, not some remote repo.
	// e.g. http://source-controller.flux-system.svc.cluster.local./helmrepository/default/bitnami/index.yaml
	// Flux does the hard work of pulling the index file from remote repo
	// into local cluster based on secretRef associated with HelmRepository, if applicable
	bytes, err := httpclient.Get(indexUrl, httpclient.New(), map[string]string{})
	if err != nil {
		return nil, err
	}

	modelRepo := &chart.Repo{
		Namespace: repo.Namespace,
		Name:      repo.Name,
		URL:       repo.Url,
		Type:      "helm",
	}

	// this is potentially a very expensive operation for large repos like 'bitnami'
	charts, err := helm.ChartsFromIndex(bytes, modelRepo, true)
	if err != nil {
		return nil, err
	}

	responsePackages := []*corev1.AvailablePackageSummary{}
	for _, chart := range charts {
		pkg := &corev1.AvailablePackageSummary{
			DisplayName:   chart.Name,
			LatestVersion: chart.ChartVersions[0].Version,
			IconUrl:       chart.Icon,
			AvailablePackageRef: &corev1.AvailablePackageReference{
				Context:    &corev1.Context{Namespace: repo.Namespace},
				Identifier: chart.ID,
			},
		}
		responsePackages = append(responsePackages, pkg)
	}
	return responsePackages, nil
}

func newPackageRepository(unstructuredRepo map[string]interface{}) (*v1alpha1.PackageRepository, error) {
	name, found, err := unstructured.NestedString(unstructuredRepo, "metadata", "name")
	if err != nil || !found {
		return nil, status.Errorf(
			codes.Internal,
			"required field metadata.name not found on HelmRepository: %v:\n%s", err, prettyPrintMap(unstructuredRepo))
	}
	namespace, found, err := unstructured.NestedString(unstructuredRepo, "metadata", "namespace")
	if err != nil || !found {
		return nil, status.Errorf(
			codes.Internal,
			"field metadata.namespace not found on HelmRepository: %v:\n%s", err, prettyPrintMap(unstructuredRepo))
	}
	url, found, err := unstructured.NestedString(unstructuredRepo, "spec", "url")
	if err != nil || !found {
		return nil, status.Errorf(
			codes.Internal,
			"required field spec.url not found on HelmRepository: %v:\n%s", err, prettyPrintMap(unstructuredRepo))
	}
	return &v1alpha1.PackageRepository{
		Name:      name,
		Namespace: namespace,
		Url:       url,
	}, nil
}
