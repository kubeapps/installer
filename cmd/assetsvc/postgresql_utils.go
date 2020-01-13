/*
Copyright (c) 2018 Bitnami

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
	"encoding/base64"
	"fmt"

	"github.com/kubeapps/common/datastore"
	"github.com/kubeapps/kubeapps/pkg/chart/models"
	"github.com/kubeapps/kubeapps/pkg/dbutils"
	_ "github.com/lib/pq"
)

type postgresAssetManager struct {
	dbutils.PostgresAssetManagerIface
}

func newPGManager(config datastore.Config) (assetManager, error) {
	m, err := dbutils.NewPGManager(config)
	if err != nil {
		return nil, err
	}
	return &postgresAssetManager{m}, nil
}

func exists(current []string, str string) bool {
	for _, s := range current {
		if s == str {
			return true
		}
	}
	return false
}

func (m *postgresAssetManager) getPaginatedChartList(repo string, pageNumber, pageSize int, showDuplicates bool) ([]*models.Chart, int, error) {
	repoQuery := ""
	if repo != "" {
		repoQuery = fmt.Sprintf("WHERE info -> 'repo' ->> 'name' = '%s'", repo)
	}
	dbQuery := fmt.Sprintf("SELECT info FROM %s %s ORDER BY info ->> 'name' ASC", dbutils.ChartTable, repoQuery)
	charts, err := m.QueryAllCharts(dbQuery)
	if err != nil {
		return nil, 0, nil
	}
	if !showDuplicates {
		// Group by unique digest for the latest version (remove duplicates)
		uniqueCharts := []*models.Chart{}
		digests := []string{}
		for _, c := range charts {
			if !exists(digests, c.ChartVersions[0].Digest) {
				digests = append(digests, c.ChartVersions[0].Digest)
				uniqueCharts = append(uniqueCharts, c)
			}
		}
		// TODO(andresmgot): Implement pagination but currently Kubeapps don't support it
		return uniqueCharts, 1, nil
	}
	return charts, 1, nil
}

func (m *postgresAssetManager) getChart(chartID string) (models.Chart, error) {
	var chart models.ChartIconString
	err := m.QueryOne(&chart, fmt.Sprintf("SELECT info FROM %s WHERE chart_id = $1", dbutils.ChartTable), chartID)
	if err != nil {
		return models.Chart{}, err
	}

	// TODO(andresmgot): Store raw_icon as a byte array
	icon, err := base64.StdEncoding.DecodeString(chart.RawIcon)
	if err != nil {
		return models.Chart{}, err
	}
	return models.Chart{
		ID:              chart.ID,
		Name:            chart.Name,
		Repo:            chart.Repo,
		Description:     chart.Description,
		Home:            chart.Home,
		Keywords:        chart.Keywords,
		Maintainers:     chart.Maintainers,
		Sources:         chart.Sources,
		Icon:            chart.Icon,
		RawIcon:         icon,
		IconContentType: chart.IconContentType,
		ChartVersions:   chart.ChartVersions,
	}, nil
}

func (m *postgresAssetManager) getChartVersion(chartID, version string) (models.Chart, error) {
	var chart models.Chart
	err := m.QueryOne(&chart, fmt.Sprintf("SELECT info FROM %s WHERE chart_id = $1", dbutils.ChartTable), chartID)
	if err != nil {
		return models.Chart{}, err
	}
	for _, c := range chart.ChartVersions {
		if c.Version == version {
			chart.ChartVersions = []models.ChartVersion{c}
			break
		}
	}
	return chart, nil
}

func (m *postgresAssetManager) getChartFiles(filesID string) (models.ChartFiles, error) {
	var chartFiles models.ChartFiles
	err := m.QueryOne(&chartFiles, fmt.Sprintf("SELECT info FROM %s WHERE chart_files_id = $1", dbutils.ChartFilesTable), filesID)
	if err != nil {
		return models.ChartFiles{}, err
	}
	return chartFiles, nil
}

func containsVersionAndAppVersion(chartVersions []models.ChartVersion, version, appVersion string) (models.ChartVersion, bool) {
	for _, ch := range chartVersions {
		if ch.Version == version && ch.AppVersion == appVersion {
			return ch, true
		}
	}
	return models.ChartVersion{}, false
}

func (m *postgresAssetManager) getChartsWithFilters(name, version, appVersion string) ([]*models.Chart, error) {
	charts, err := m.QueryAllCharts(fmt.Sprintf("SELECT info FROM %s WHERE info ->> 'name' = $1", dbutils.ChartTable), name)
	if err != nil {
		return nil, err
	}
	result := []*models.Chart{}
	for _, c := range charts {
		if cv, found := containsVersionAndAppVersion(c.ChartVersions, version, appVersion); found {
			// Return only the interesting ChartVersion
			c.ChartVersions = []models.ChartVersion{cv}
			result = append(result, c)
		}
	}
	return result, nil
}

// NOTE: searchCharts is not currently being used in Kubeapps
func (m *postgresAssetManager) searchCharts(query, repo string) ([]*models.Chart, error) {
	repoQuery := ""
	if repo != "" {
		repoQuery = fmt.Sprintf("info -> 'repo' ->> 'name' = '%s' AND", repo)
	}
	dbQuery := fmt.Sprintf(
		"SELECT info FROM %s WHERE %s (info ->> 'name' ~ $1) "+
			"OR (info ->> 'description' ~ $1) "+
			"OR (info -> 'repo' ->> 'name' ~ $1) "+
			// TODO(andresmgot): compare keywords one by one
			"OR (info ->> 'keywords' ~ $1)"+
			// TODO(andresmgot): compare sources one by one
			"OR (info ->> 'sources' ~ $1)"+
			// TODO(andresmgot): compare maintainers one by one
			"OR (info ->> 'maintainers' ~ $1)",
		dbutils.ChartTable,
		repoQuery,
	)
	return m.QueryAllCharts(dbQuery, query)
}
