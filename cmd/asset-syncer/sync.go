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
	"os"
	"time"

	"github.com/kubeapps/common/datastore"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var syncCmd = &cobra.Command{
	Use:   "sync [REPO NAME] [REPO URL]",
	Short: "add a new chart repository, and resync its charts periodically",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) != 2 {
			logrus.Info("Need exactly two arguments: [REPO NAME] [REPO URL]")
			cmd.Help()
			return
		}

		if debug {
			logrus.SetLevel(logrus.DebugLevel)
		}

		dbConfig := datastore.Config{URL: databaseURL, Database: databaseName, Username: databaseUser, Password: databasePassword}
		manager, err := newManager(databaseType, dbConfig)
		if err != nil {
			logrus.Fatal(err)
		}
		err = manager.Init()
		if err != nil {
			logrus.Fatal(err)
		}
		defer manager.Close()

		authorizationHeader := os.Getenv("AUTHORIZATION_HEADER")
		r, repoContent, err := getRepo(args[0], args[1], authorizationHeader)
		if err != nil {
			logrus.Fatal(err)
		}

		// Check if the repo has been already processed
		if manager.RepoAlreadyProcessed(r.Name, r.Checksum) {
			logrus.WithFields(logrus.Fields{"url": r.URL}).Info("Skipping repository since there are no updates")
			return
		}

		index, err := parseRepoIndex(repoContent)
		if err != nil {
			logrus.Fatal(err)
		}

		charts := chartsFromIndex(index, r)
		if len(charts) == 0 {
			logrus.Fatal("no charts in repository index")
		}

		if err = manager.Sync(charts); err != nil {
			logrus.Fatalf("Can't add chart repository to database: %v", err)
		}

		// Update cache in the database
		if err = manager.UpdateLastCheck(r.Name, r.Checksum, time.Now()); err != nil {
			logrus.Fatal(err)
		}
		logrus.WithFields(logrus.Fields{"url": r.URL}).Info("Stored repository update in cache")

		logrus.Infof("Successfully added the chart repository %s to database", args[0])
	},
}
