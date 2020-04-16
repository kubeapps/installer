package agent

import (
	"bytes"
	"io"
	"strings"

	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

// DockerSecretsPostRenderer is a helm post-renderer (see https://helm.sh/docs/topics/advanced/#post-rendering)
// which appends image pull secrets to container images which match specified registry domains.
type DockerSecretsPostRenderer struct {
	// secrets maps a registry domain to a single secret to be used for that domain.
	secrets map[string]string
}

// NewDockerSecretsPostRenderer returns a post renderer configured with the specified secrets.
func NewDockerSecretsPostRenderer(secrets map[string]string) *DockerSecretsPostRenderer {
	return &DockerSecretsPostRenderer{secrets}
}

// Run returns the rendered yaml including any additions of the post-renderer.
// An error is only returned if the manifests cannot be parsed or re-rendered.
func (r *DockerSecretsPostRenderer) Run(renderedManifests *bytes.Buffer) (modifiedManifests *bytes.Buffer, err error) {
	if r.secrets == nil {
		return renderedManifests, nil
	}

	decoder := yaml.NewDecoder(renderedManifests)
	var resourceList []interface{}
	for {
		var resource interface{}
		err := decoder.Decode(&resource)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		resourceList = append(resourceList, resource)
	}

	// TODO(mnelson): If re-rendering the entire manifest creates issues, we
	// could instead find the correct byte position and insert the image pull
	// secret into the byte stream at the relevant points, but this will be
	// more complex.
	for _, resourceItem := range resourceList {
		resource, ok := resourceItem.(map[interface{}]interface{})
		if !ok {
			continue
		}
		podSpec := getResourcePodSpec(resource)
		if podSpec == nil {
			continue
		}
		r.updatePodSpecWithPullSecrets(podSpec)
	}

	modifiedManifests = bytes.NewBuffer([]byte{})
	encoder := yaml.NewEncoder(modifiedManifests)
	defer encoder.Close()

	for _, resource := range resourceList {
		err = encoder.Encode(resource)
		if err != nil {
			return nil, err
		}
	}

	return modifiedManifests, nil
}

// updatePodSpecWithPullSecrets updates the podSpec inline with the relevant pull secrets.
// We do not parse the yaml into actual Kubernetes objects since we want to be
// independent of api versions. This requires special care and limitations, so
// we limit our assumptions of the untyped handling to the following:
// - The pod spec includes a 'containers' key with a slice value
// - Each container value is a map with an 'image' key and string value.
// An invalid resource doc is logged but left for the k8s API to respond to.
func (r *DockerSecretsPostRenderer) updatePodSpecWithPullSecrets(podSpec map[interface{}]interface{}) {
	containersObject, ok := podSpec["containers"]
	if !ok {
		log.Errorf("podSpec contained no containers key: %+v", podSpec)
		return
	}
	containers, ok := containersObject.([]interface{})
	if !ok {
		log.Errorf("podSpec containers key is not a slice: %+v", podSpec)
		return
	}

	// If there are existing pull secrets, initialise our slice with that value
	// and additionally initialize a map keyed by secret name which we can
	// use to test existence more easily.
	var imagePullSecrets []map[string]interface{}
	existingNames := map[string]bool{}
	if existingPullSecrets, ok := podSpec["imagePullSecrets"]; ok {
		imagePullSecrets = existingPullSecrets.([]map[string]interface{})
		for _, s := range imagePullSecrets {
			if name, ok := s["name"]; ok {
				if n, ok := name.(string); ok {
					existingNames[n] = true
				}
			}
		}
	}

	for _, c := range containers {
		container, ok := c.(map[interface{}]interface{})
		if !ok {
			log.Errorf("pod spec container is not a map: %+v", c)
			continue
		}
		image, ok := container["image"].(string)
		if !ok {
			// NOTE: in https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.18/#container-v1-core
			// the image is optional to allow higher level config management to default or override (such as
			// deployments or statefulsets), but both only define pod templates which in turn define containers?
			log.Errorf("pod spec container does not define an string image: %+v", container)
			continue
		}

		// Ignore (dockerhub) image refs without a domain.
		domainSplit := strings.Split(image, "/")
		if len(domainSplit) == 1 {
			continue
		}
		imageDomain := domainSplit[0]

		secretName, ok := r.secrets[imageDomain]
		if !ok {
			continue
		}
		// Only add the secret if it's not already included in the image pull secrets.
		if _, ok := existingNames[secretName]; !ok {
			imagePullSecrets = append(imagePullSecrets, map[string]interface{}{"name": secretName})
			existingNames[secretName] = true
		}
	}

	if len(imagePullSecrets) > 0 {
		podSpec["imagePullSecrets"] = imagePullSecrets
	}
}

// getResourcePodSpec checks the kind of the resource and extracts the pod spec accordingly.
// We do not parse the yaml into actual Kubernetes objects since we want to be
// independent of api versions. This requires special care and limitations, so
// we limit our assumptions of the untyped handling to the following, with any
// invalid docs ignored and left for the API server to respond accordingly:
// - A resource doc is a map with a "kind" key with a string value
// - A pod resource doc has a "spec" key containing a map
func getResourcePodSpec(resource map[interface{}]interface{}) map[interface{}]interface{} {
	kindValue, ok := resource["kind"]
	if !ok {
		log.Errorf("invalid resource: no kind. %+v", resource)
		return nil
	}

	kind, ok := kindValue.(string)
	if !ok {
		log.Errorf("invalid resource: non-string resource kind. %+v", resource)
		return nil
	}

	// TODO: Update to support other kinds with pod specs as part of pod templates:
	// https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.18/#podtemplatespec-v1-core
	switch kind {
	case "Pod":
		podSpec, ok := resource["spec"].(map[interface{}]interface{})
		if !ok {
			log.Errorf("invalid resource: non-map pod spec. %+v", resource)
			return nil
		}
		return podSpec
	}

	return nil
}
