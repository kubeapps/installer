// The Dashboard doesn't understand the Helm 3 release format.
// This file is a compatibility layer that translates Helm 3 releases to a Helm 2-similar format suitable for the Dashboard.
// Note that h3.Release and h2.Release are not isomorphic, so it is impossible to map between them in general.

package handler

import (
	"strings"

	"github.com/golang/protobuf/ptypes/any"
	"gopkg.in/yaml.v2"
	h3chart "helm.sh/helm/v3/pkg/chart"
	h3 "helm.sh/helm/v3/pkg/release"
	h2chart "k8s.io/helm/pkg/proto/hapi/chart"
	h2 "k8s.io/helm/pkg/proto/hapi/release"
)

// generatedYamlHeader is prepended to YAML generated from the internal map[string]interface{} representation.
const generatedYamlHeader = "# Not original YAML! Generated from parsed representation."

func newDashboardCompatibleRelease(h3r h3.Release) h2.Release {
	return h2.Release{
		Name:      h3r.Name,
		Info:      &h2.Info{Status: compatibleStatus(*h3r.Info)},
		Chart:     compatibleChart(*h3r.Chart),
		Config:    compatibleConfig(h3r),
		Manifest:  h3r.Manifest,
		Version:   int32(h3r.Version),
		Namespace: h3r.Namespace,
	}
}

func compatibleChart(h3c h3chart.Chart) *h2chart.Chart {
	return &h2chart.Chart{
		Files:     compatibleFiles(h3c.Files),
		Metadata:  compatibleMetadata(*h3c.Metadata),
		Templates: compatibleTemplates(h3c.Templates),
		Values:    compatibleValues(h3c),
	}
}

func compatibleMetadata(h3m h3chart.Metadata) *h2chart.Metadata {
	return &h2chart.Metadata{
		Annotations:   h3m.Annotations,
		ApiVersion:    h3m.APIVersion,
		AppVersion:    h3m.AppVersion,
		Condition:     h3m.Condition,
		Deprecated:    h3m.Deprecated,
		Description:   h3m.Description,
		Engine:        "",
		Home:          h3m.Home,
		Icon:          h3m.Icon,
		Keywords:      h3m.Keywords,
		KubeVersion:   h3m.KubeVersion,
		Maintainers:   compatibleMaintainers(h3m.Maintainers),
		Name:          h3m.Name,
		Sources:       h3m.Sources,
		Tags:          h3m.Tags,
		TillerVersion: "",
		Version:       h3m.Version,
	}
}

func compatibleMaintainers(h3ms []*h3chart.Maintainer) []*h2chart.Maintainer {
	h2ms := make([]*h2chart.Maintainer, len(h3ms))
	for i, m := range h3ms {
		h2ms[i] = &h2chart.Maintainer{
			Name:  m.Name,
			Email: m.Email,
			Url:   m.URL,
		}
	}
	return h2ms
}

func compatibleFiles(h3files []*h3chart.File) []*any.Any {
	anys := make([]*any.Any, len(h3files))
	for i, f := range h3files {
		anys[i] = &any.Any{
			TypeUrl: f.Name,
			Value:   f.Data,
		}
	}
	return anys
}

func compatibleTemplates(h3templates []*h3chart.File) []*h2chart.Template {
	templates := make([]*h2chart.Template, len(h3templates))
	for i, t := range h3templates {
		templates[i] = &h2chart.Template{
			Name: t.Name,
			Data: t.Data,
		}
	}
	return templates
}

func compatibleValues(h3c h3chart.Chart) *h2chart.Config {
	return &h2chart.Config{
		Raw: valuesToYaml(h3c.Values),
	}
}

func compatibleConfig(h3r h3.Release) *h2chart.Config {
	return &h2chart.Config{
		Raw: valuesToYaml(h3r.Config),
	}
}

// valuesToYaml serializes to YAML and prepends an informative header.
// It assumes that the serialization succeeds.
func valuesToYaml(values map[string]interface{}) string {
	marshaled, _ := yaml.Marshal(values)
	return generatedYamlHeader + "\n" + string(marshaled)
}

func compatibleStatus(h3info h3.Info) *h2.Status {
	return &h2.Status{
		Code:  compatibleStatusCode(h3info.Status),
		Notes: h3info.Notes,
	}
}

func compatibleStatusCode(h3status h3.Status) h2.Status_Code {
	// "delet" is not a typo; "uninstalling" should become "deleting", not "deleteing".
	withDelete := strings.ReplaceAll(h3status.String(), "uninstall", "delet")
	withUnderscores := strings.ReplaceAll(withDelete, "-", "_")
	withUpperCase := strings.ToUpper(withUnderscores)
	// If the key is not found in the map, Status_UNKNOWN (0) is returned.
	return h2.Status_Code(h2.Status_Code_value[withUpperCase])
}
