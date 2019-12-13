/*
Copyright (c) 2018 The Helm Authors

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
	"testing"
	"time"

	"github.com/arschles/assert"
	"github.com/globalsign/mgo/bson"
	"github.com/kubeapps/common/datastore"
	"github.com/kubeapps/common/datastore/mockstore"
	"github.com/kubeapps/kubeapps/pkg/dbutils"
	"github.com/stretchr/testify/mock"
)

func Test_importCharts(t *testing.T) {
	m := &mock.Mock{}
	// Ensure Upsert func is called with some arguments
	m.On("Upsert", mock.Anything)
	m.On("RemoveAll", mock.Anything)
	dbSession := mockstore.NewMockSession(m)
	index, _ := parseRepoIndex([]byte(validRepoIndexYAML))
	charts := chartsFromIndex(index, &repo{Name: "test", URL: "http://testrepo.com"})
	man := dbutils.NewMongoDBManager(datastore.Config{})
	man.DBSession = dbSession
	manager := &mongodbAssetManager{man}
	manager.importCharts(charts)

	m.AssertExpectations(t)
	// The Bulk Upsert method takes an array that consists of a selector followed by an interface to upsert.
	// So for x charts to upsert, there should be x*2 elements (each chart has it's own selector)
	// e.g. [selector1, chart1, selector2, chart2, ...]
	args := m.Calls[0].Arguments.Get(0).([]interface{})
	assert.Equal(t, len(args), len(charts)*2, "number of selector, chart pairs to upsert")
	for i := 0; i < len(args); i += 2 {
		c := args[i+1].(chart)
		assert.Equal(t, args[i], bson.M{"_id": "test/" + c.Name}, "selector")
	}
}

func Test_DeleteRepo(t *testing.T) {
	m := &mock.Mock{}
	m.On("RemoveAll", bson.M{
		"repo.name": "test",
	})
	m.On("RemoveAll", bson.M{
		"_id": "test",
	})
	dbSession := mockstore.NewMockSession(m)

	man := dbutils.NewMongoDBManager(datastore.Config{})
	man.DBSession = dbSession
	manager := &mongodbAssetManager{man}
	err := manager.Delete("test")
	if err != nil {
		t.Errorf("failed to delete chart repo test: %v", err)
	}
	m.AssertExpectations(t)
}

func Test_emptyChartRepo(t *testing.T) {
	r := &repo{Name: "testRepo", URL: "https://my.examplerepo.com", Checksum: "123"}
	i, err := parseRepoIndex(emptyRepoIndexYAMLBytes)
	assert.NoErr(t, err)
	charts := chartsFromIndex(i, r)
	assert.Equal(t, len(charts), 0, "charts")
}

func Test_repoAlreadyProcessed(t *testing.T) {
	tests := []struct {
		name            string
		checksum        string
		mockedLastCheck repoCheck
		processed       bool
	}{
		{"not processed yet", "bar", repoCheck{}, false},
		{"already processed", "bar", repoCheck{Checksum: "bar"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := mock.Mock{}
			repo := &repoCheck{}
			m.On("One", repo).Run(func(args mock.Arguments) {
				*args.Get(0).(*repoCheck) = tt.mockedLastCheck
			}).Return(nil)
			dbSession := mockstore.NewMockSession(&m)
			man := dbutils.NewMongoDBManager(datastore.Config{})
			man.DBSession = dbSession
			manager := &mongodbAssetManager{man}
			res := manager.RepoAlreadyProcessed("", tt.checksum)
			if res != tt.processed {
				t.Errorf("Expected alreadyProcessed to be %v got %v", tt.processed, res)
			}
		})
	}
}

func Test_updateLastCheck(t *testing.T) {
	m := mock.Mock{}
	repoName := "foo"
	checksum := "bar"
	now := time.Now()
	m.On("UpsertId", repoName, bson.M{"$set": bson.M{"last_update": now, "checksum": checksum}}).Return(nil)
	dbSession := mockstore.NewMockSession(&m)
	man := dbutils.NewMongoDBManager(datastore.Config{})
	man.DBSession = dbSession
	manager := &mongodbAssetManager{man}
	err := manager.UpdateLastCheck(repoName, checksum, now)
	if err != nil {
		t.Errorf("Unexpected error %v", err)
	}
	if len(m.Calls) != 1 {
		t.Errorf("Expected one call got %d", len(m.Calls))
	}
}
