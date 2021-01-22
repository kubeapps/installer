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
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/arschles/assert"
	"github.com/disintegration/imaging"
	"github.com/kubeapps/common/datastore"
	"github.com/kubeapps/kubeapps/pkg/chart/models"
	log "github.com/sirupsen/logrus"
)

var validRepoIndexYAMLBytes, _ = ioutil.ReadFile("testdata/valid-index.yaml")
var validRepoIndexYAML = string(validRepoIndexYAMLBytes)

var invalidRepoIndexYAML = "invalid"

type badHTTPClient struct{}

func (h *badHTTPClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	w.WriteHeader(500)
	return w.Result(), nil
}

type goodHTTPClient struct{}

func (h *goodHTTPClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	// Don't accept trailing slashes
	if strings.HasPrefix(req.URL.Path, "//") {
		w.WriteHeader(500)
	}
	// If subpath repo URL test, check that index.yaml is correctly added to the
	// subpath
	if req.URL.Host == "subpath.test" && req.URL.Path != "/subpath/index.yaml" {
		w.WriteHeader(500)
	}

	w.Write([]byte(validRepoIndexYAML))
	return w.Result(), nil
}

type authenticatedHTTPClient struct{}

func (h *authenticatedHTTPClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()

	// Ensure we're sending the right Authorization header
	if !strings.Contains(req.Header.Get("Authorization"), "Bearer ThisSecretAccessTokenAuthenticatesTheClient") {
		w.WriteHeader(500)
	}
	w.Write([]byte(validRepoIndexYAML))
	return w.Result(), nil
}

type badIconClient struct{}

func (h *badIconClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	w.Write([]byte("not-an-image"))
	return w.Result(), nil
}

type goodIconClient struct{}

func iconBytes() []byte {
	var b bytes.Buffer
	img := imaging.New(1, 1, color.White)
	imaging.Encode(&b, img, imaging.PNG)
	return b.Bytes()
}

func iconB64() string {
	return base64.StdEncoding.EncodeToString(iconBytes())
}

func (h *goodIconClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	w.Write(iconBytes())
	return w.Result(), nil
}

type svgIconClient struct{}

func (h *svgIconClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	w.Write([]byte("foo"))
	res := w.Result()
	res.Header.Set("Content-Type", "image/svg")
	return res, nil
}

type goodTarballClient struct {
	c          models.Chart
	skipReadme bool
	skipValues bool
	skipSchema bool
}

var testChartReadme = "# readme for chart\n\nBest chart in town"
var testChartValues = "image: test"
var testChartSchema = `{"properties": {}}`

func (h *goodTarballClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	gzw := gzip.NewWriter(w)
	files := []tarballFile{{h.c.Name + "/Chart.yaml", "should be a Chart.yaml here..."}}
	if !h.skipValues {
		files = append(files, tarballFile{h.c.Name + "/values.yaml", testChartValues})
	}
	if !h.skipReadme {
		files = append(files, tarballFile{h.c.Name + "/README.md", testChartReadme})
	}
	if !h.skipSchema {
		files = append(files, tarballFile{h.c.Name + "/values.schema.json", testChartSchema})
	}
	createTestTarball(gzw, files)
	gzw.Flush()
	return w.Result(), nil
}

type authenticatedTarballClient struct {
	c models.Chart
}

func (h *authenticatedTarballClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()

	// Ensure we're sending the right Authorization header
	if !strings.Contains(req.Header.Get("Authorization"), "Bearer ThisSecretAccessTokenAuthenticatesTheClient") {
		w.WriteHeader(500)
	} else {
		gzw := gzip.NewWriter(w)
		files := []tarballFile{{h.c.Name + "/Chart.yaml", "should be a Chart.yaml here..."}}
		files = append(files, tarballFile{h.c.Name + "/values.yaml", testChartValues})
		files = append(files, tarballFile{h.c.Name + "/README.md", testChartReadme})
		files = append(files, tarballFile{h.c.Name + "/values.schema.json", testChartSchema})
		createTestTarball(gzw, files)
		gzw.Flush()
	}
	return w.Result(), nil
}

func Test_syncURLInvalidity(t *testing.T) {
	tests := []struct {
		name    string
		repoURL string
	}{
		{"invalid URL", "not-a-url"},
		{"invalid URL", "https//google.com"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := getHelmRepo("namespace", "test", tt.repoURL, "")
			assert.ExistsErr(t, err, tt.name)
		})
	}
}

func Test_fetchRepoIndex(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"valid HTTP URL", "http://my.examplerepo.com"},
		{"valid HTTPS URL", "https://my.examplerepo.com"},
		{"valid trailing URL", "https://my.examplerepo.com/"},
		{"valid subpath URL", "https://subpath.test/subpath/"},
		{"valid URL with trailing spaces", "https://subpath.test/subpath/  "},
		{"valid URL with leading spaces", "  https://subpath.test/subpath/"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			netClient = &goodHTTPClient{}
			_, err := fetchRepoIndex(tt.url, "")
			assert.NoErr(t, err)
		})
	}

	t.Run("authenticated request", func(t *testing.T) {
		netClient = &authenticatedHTTPClient{}
		_, err := fetchRepoIndex("https://my.examplerepo.com", "Bearer ThisSecretAccessTokenAuthenticatesTheClient")
		assert.NoErr(t, err)
	})

	t.Run("failed request", func(t *testing.T) {
		netClient = &badHTTPClient{}
		_, err := fetchRepoIndex("https://my.examplerepo.com", "")
		assert.ExistsErr(t, err, "failed request")
	})
}

func Test_fetchRepoIndexUserAgent(t *testing.T) {
	tests := []struct {
		name              string
		version           string
		userAgentComment  string
		expectedUserAgent string
	}{
		{"default user agent", "", "", "asset-syncer/devel"},
		{"custom version no app", "1.0", "", "asset-syncer/1.0"},
		{"custom version and app", "1.0", "monocular/1.2", "asset-syncer/1.0 (monocular/1.2)"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Override global variables used to generate the userAgent
			if tt.version != "" {
				version = tt.version
			}

			if tt.userAgentComment != "" {
				userAgentComment = tt.userAgentComment
			}

			server := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
				assert.Equal(t, tt.expectedUserAgent, req.Header.Get("User-Agent"), "expected user agent")
				rw.Write([]byte(validRepoIndexYAML))
			}))
			// Close the server when test finishes
			defer server.Close()

			netClient = server.Client()

			_, err := fetchRepoIndex(server.URL, "")
			assert.NoErr(t, err)
		})
	}
}

func Test_parseRepoIndex(t *testing.T) {
	tests := []struct {
		name     string
		repoYAML string
	}{
		{"invalid", "invalid"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseRepoIndex([]byte(tt.repoYAML))
			assert.ExistsErr(t, err, tt.name)
		})
	}

	t.Run("valid", func(t *testing.T) {
		index, err := parseRepoIndex([]byte(validRepoIndexYAML))
		assert.NoErr(t, err)
		assert.Equal(t, len(index.Entries), 2, "number of charts")
		assert.Equal(t, index.Entries["acs-engine-autoscaler"][0].GetName(), "acs-engine-autoscaler", "chart version populated")
	})
}

func Test_chartsFromIndex(t *testing.T) {
	r := &models.Repo{Name: "test", URL: "http://testrepo.com"}
	index, _ := parseRepoIndex([]byte(validRepoIndexYAML))
	charts := chartsFromIndex(index, r)
	assert.Equal(t, len(charts), 2, "number of charts")

	indexWithDeprecated := validRepoIndexYAML + `
  deprecated-chart:
  - name: deprecated-chart
    deprecated: true`
	index2, err := parseRepoIndex([]byte(indexWithDeprecated))
	assert.NoErr(t, err)
	charts = chartsFromIndex(index2, r)
	assert.Equal(t, len(charts), 2, "number of charts")
}

func Test_newChart(t *testing.T) {
	r := &models.Repo{Name: "test", URL: "http://testrepo.com"}
	index, _ := parseRepoIndex([]byte(validRepoIndexYAML))
	c := newChart(index.Entries["wordpress"], r)
	assert.Equal(t, c.Name, "wordpress", "correctly built")
	assert.Equal(t, len(c.ChartVersions), 2, "correctly built")
	assert.Equal(t, c.Description, "new description!", "takes chart fields from latest entry")
	assert.Equal(t, c.Repo, r, "repo set")
	assert.Equal(t, c.ID, "test/wordpress", "id set")
}

func Test_chartTarballURL(t *testing.T) {
	r := &models.RepoInternal{Name: "test", URL: "http://testrepo.com"}
	tests := []struct {
		name   string
		cv     models.ChartVersion
		wanted string
	}{
		{"absolute url", models.ChartVersion{URLs: []string{"http://testrepo.com/wordpress-0.1.0.tgz"}}, "http://testrepo.com/wordpress-0.1.0.tgz"},
		{"relative url", models.ChartVersion{URLs: []string{"wordpress-0.1.0.tgz"}}, "http://testrepo.com/wordpress-0.1.0.tgz"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, chartTarballURL(r, tt.cv), tt.wanted, "url")
		})
	}
}

func Test_extractFilesFromTarball(t *testing.T) {
	tests := []struct {
		name     string
		files    []tarballFile
		filename string
		want     string
	}{
		{"file", []tarballFile{{"file.txt", "best file ever"}}, "file.txt", "best file ever"},
		{"multiple file tarball", []tarballFile{{"file.txt", "best file ever"}, {"file2.txt", "worst file ever"}}, "file2.txt", "worst file ever"},
		{"file in dir", []tarballFile{{"file.txt", "best file ever"}, {"test/file2.txt", "worst file ever"}}, "test/file2.txt", "worst file ever"},
		{"filename ignore case", []tarballFile{{"Readme.md", "# readme for chart"}, {"values.yaml", "key: value"}}, "README.md", "# readme for chart"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var b bytes.Buffer
			createTestTarball(&b, tt.files)
			r := bytes.NewReader(b.Bytes())
			tarf := tar.NewReader(r)
			files, err := extractFilesFromTarball(map[string]string{tt.filename: tt.filename}, tarf)
			assert.NoErr(t, err)
			assert.Equal(t, files[tt.filename], tt.want, "file body")
		})
	}

	t.Run("extract multiple files", func(t *testing.T) {
		var b bytes.Buffer
		tFiles := []tarballFile{{"file.txt", "best file ever"}, {"file2.txt", "worst file ever"}}
		createTestTarball(&b, tFiles)
		r := bytes.NewReader(b.Bytes())
		tarf := tar.NewReader(r)
		files, err := extractFilesFromTarball(map[string]string{tFiles[0].Name: tFiles[0].Name, tFiles[1].Name: tFiles[1].Name}, tarf)
		assert.NoErr(t, err)
		assert.Equal(t, len(files), 2, "matches")
		for _, f := range tFiles {
			assert.Equal(t, files[f.Name], f.Body, "file body")
		}
	})

	t.Run("file not found", func(t *testing.T) {
		var b bytes.Buffer
		createTestTarball(&b, []tarballFile{{"file.txt", "best file ever"}})
		r := bytes.NewReader(b.Bytes())
		tarf := tar.NewReader(r)
		name := "file2.txt"
		files, err := extractFilesFromTarball(map[string]string{name: name}, tarf)
		assert.NoErr(t, err)
		assert.Equal(t, files[name], "", "file body")
	})

	t.Run("not a tarball", func(t *testing.T) {
		b := make([]byte, 4)
		rand.Read(b)
		r := bytes.NewReader(b)
		tarf := tar.NewReader(r)
		files, err := extractFilesFromTarball(map[string]string{values: "file2.txt"}, tarf)
		assert.Err(t, io.ErrUnexpectedEOF, err)
		assert.Equal(t, len(files), 0, "file body")
	})
}

type tarballFile struct {
	Name, Body string
}

func createTestTarball(w io.Writer, files []tarballFile) {
	// Create a new tar archive.
	tarw := tar.NewWriter(w)

	// Add files to the archive.
	for _, file := range files {
		hdr := &tar.Header{
			Name: file.Name,
			Mode: 0600,
			Size: int64(len(file.Body)),
		}
		if err := tarw.WriteHeader(hdr); err != nil {
			log.Fatalln(err)
		}
		if _, err := tarw.Write([]byte(file.Body)); err != nil {
			log.Fatalln(err)
		}
	}
	// Make sure to check the error on Close.
	if err := tarw.Close(); err != nil {
		log.Fatal(err)
	}
}

func Test_initNetClient(t *testing.T) {
	// Test env
	otherDir, err := ioutil.TempDir("", "ca-registry")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(otherDir)

	// Create cert
	caCert := `-----BEGIN CERTIFICATE-----
MIIC6jCCAdKgAwIBAgIUKVfzA7lfBgSYP8enCVhlm0ql5YwwDQYJKoZIhvcNAQEL
BQAwDTELMAkGA1UEAxMCQ0EwHhcNMTgxMjEyMTQxNzAwWhcNMjMxMjExMTQxNzAw
WjANMQswCQYDVQQDEwJDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
ALZU3fsAgvoUuLSHr24apslaYyuX84wGoZQmtFtQ+A3DF9KL/2nn3yZ6qJPkH0TF
sbObEQRNi+P6vQ3nI/dSNMX5PzMBP2CB6L7zEXzZQEHtAK0Bzva5CKEBGX7OfIKl
aBvs+dzKVJBdb+Oh0maacMwa4QbcD6ejzF90jUbaO65lpQpcL7KQdppKOGNclRaA
hQTV2VsxrV4hH7K9btaTTxso+8W6p8v6X9vf40Ywx72p+SKnGh+FCrOp1gYLBLwo
4SM0OUQHRvqUlj0XhZk5pW0dMRwHcoz1S2GmE5bj4edr4j+zGzGxa2wRGKvM0OCn
Do84AVszTFPmUf+mCl4pJNECAwEAAaNCMEAwDgYDVR0PAQH/BAQDAgEGMA8GA1Ud
EwEB/wQFMAMBAf8wHQYDVR0OBBYEFI5l5k+MEhrbOQ29dOW1qJhI0yKaMA0GCSqG
SIb3DQEBCwUAA4IBAQByDebUOKzn6jfmXlW62vm09V+ipqId01wm21G9XMtMEqhc
xtun6YwQeTuGPtdepWG+NXuSsiX/HNAHeaumJaaljHhdKDisnMQ0CTnNsu8NPkAl
9iMEB3iXLWkb7+HgfPJAHZVGcMqMxNEMZYHB1Fh0G2Ne376X94+GYJ08qR2C8rUP
BShhMSktB578h4GtPIWSjPhDUWg1fGe7sewR+GPyuL9859hOD0wGm9tUixBKloCu
b90fhqZZ3FqZD7W1qJGKvz/8geqi0noip+uq/dokK1jarRkOVEJP+EvXkHo0tIuc
h251U/Daz6NiQBM9AxyAw6EHm8XAZBvCuebfzyrT
-----END CERTIFICATE-----`
	otherCA := path.Join(otherDir, "ca.crt")
	err = ioutil.WriteFile(otherCA, []byte(caCert), 0644)
	if err != nil {
		t.Error(err)
	}

	_, err = initNetClient(otherCA)
	if err != nil {
		t.Error(err)
	}
}

var emptyRepoIndexYAMLBytes, _ = ioutil.ReadFile("testdata/empty-repo-index.yaml")
var emptyRepoIndexYAML = string(emptyRepoIndexYAMLBytes)

type emptyChartRepoHTTPClient struct{}

func (h *emptyChartRepoHTTPClient) Do(req *http.Request) (*http.Response, error) {
	w := httptest.NewRecorder()
	w.Write([]byte(emptyRepoIndexYAML))
	return w.Result(), nil
}

func Test_getSha256(t *testing.T) {
	sha, err := getSha256([]byte("this is a test"))
	assert.Equal(t, err, nil, "Unable to get sha")
	assert.Equal(t, sha, "2e99758548972a8e8822ad47fa1017ff72f06f3ff6a016851f45c398732bc50c", "Unable to get sha")
}

func Test_newManager(t *testing.T) {
	tests := []struct {
		name            string
		dbName          string
		dbURL           string
		dbUser          string
		dbPass          string
		expectedManager string
	}{
		{"postgresql database", "assets", "example.com:44124", "postgres", "root", "&{host=example.com port=44124 user=postgres password=root dbname=assets sslmode=disable <nil>}"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := datastore.Config{URL: tt.dbURL, Database: tt.dbName, Username: tt.dbUser, Password: tt.dbPass}
			_, err := newManager(config, "kubeapps")
			assert.NoErr(t, err)
		})
	}

}

func Test_fetchAndImportIcon(t *testing.T) {
	repo := &models.RepoInternal{Name: "test", Namespace: "repo-namespace"}
	t.Run("no icon", func(t *testing.T) {
		pgManager, _, cleanup := getMockManager(t)
		defer cleanup()
		c := models.Chart{ID: "test/acs-engine-autoscaler"}
		fImporter := fileImporter{pgManager}
		assert.NoErr(t, fImporter.fetchAndImportIcon(c, repo))
	})

	index, _ := parseRepoIndex([]byte(validRepoIndexYAML))
	charts := chartsFromIndex(index, &models.Repo{Name: "test", Namespace: "repo-namespace", URL: "http://testrepo.com"})

	t.Run("failed download", func(t *testing.T) {
		pgManager, _, cleanup := getMockManager(t)
		defer cleanup()
		netClient = &badHTTPClient{}
		fImporter := fileImporter{pgManager}
		assert.Err(t, fmt.Errorf("500 %s", charts[0].Icon), fImporter.fetchAndImportIcon(charts[0], repo))
	})

	t.Run("bad icon", func(t *testing.T) {
		pgManager, _, cleanup := getMockManager(t)
		defer cleanup()
		netClient = &badIconClient{}
		c := charts[0]
		fImporter := fileImporter{pgManager}
		assert.Err(t, image.ErrFormat, fImporter.fetchAndImportIcon(c, repo))
	})

	t.Run("valid icon", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()
		netClient = &goodIconClient{}

		mock.ExpectQuery("UPDATE charts SET info *").
			WithArgs("test/acs-engine-autoscaler", "repo-namespace", "test").
			WillReturnRows(sqlmock.NewRows([]string{"ID"}).AddRow(1))

		fImporter := fileImporter{pgManager}
		assert.NoErr(t, fImporter.fetchAndImportIcon(charts[0], repo))
	})

	t.Run("valid SVG icon", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()
		netClient = &svgIconClient{}
		c := models.Chart{
			ID:   "foo",
			Icon: "https://foo/bar/logo.svg",
			Repo: &models.Repo{Name: repo.Name, Namespace: repo.Namespace},
		}

		mock.ExpectQuery("UPDATE charts SET info *").
			WithArgs("foo", "repo-namespace", "test").
			WillReturnRows(sqlmock.NewRows([]string{"ID"}).AddRow(1))

		fImporter := fileImporter{pgManager}
		assert.NoErr(t, fImporter.fetchAndImportIcon(c, repo))
	})
}

type fakeRepo struct {
	*models.RepoInternal
	charts     []models.Chart
	chartFiles models.ChartFiles
}

func (r *fakeRepo) Checksum() (string, error) {
	return "checksum", nil
}

func (r *fakeRepo) Repo() *models.RepoInternal {
	return r.RepoInternal
}

func (r *fakeRepo) Charts() ([]models.Chart, error) {
	return r.charts, nil
}

func (r *fakeRepo) FetchFiles(name string, cv models.ChartVersion) (map[string]string, error) {
	return map[string]string{
		values: r.chartFiles.Values,
		readme: r.chartFiles.Readme,
		schema: r.chartFiles.Schema,
	}, nil
}

func Test_fetchAndImportFiles(t *testing.T) {
	index, _ := parseRepoIndex([]byte(validRepoIndexYAML))
	repo := &models.RepoInternal{Name: "test", Namespace: "repo-namespace", URL: "http://testrepo.com"}
	charts := chartsFromIndex(index, &models.Repo{Name: repo.Name, Namespace: repo.Namespace, URL: repo.URL})
	chartVersion := charts[0].ChartVersions[0]
	chartID := fmt.Sprintf("%s/%s", charts[0].Repo.Name, charts[0].Name)
	chartFilesID := fmt.Sprintf("%s-%s", chartID, chartVersion.Version)
	chartFiles := models.ChartFiles{
		ID:     chartFilesID,
		Readme: testChartReadme,
		Values: testChartValues,
		Schema: testChartSchema,
		Repo:   charts[0].Repo,
		Digest: chartVersion.Digest,
	}
	fRepo := &fakeRepo{
		RepoInternal: repo,
		charts:       charts,
		chartFiles:   chartFiles,
	}

	t.Run("http error", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()

		mock.ExpectQuery("SELECT EXISTS*").
			WithArgs(chartFilesID, repo.Name, repo.Namespace).
			WillReturnRows(sqlmock.NewRows([]string{"ID"}).AddRow(1))
		netClient = &badHTTPClient{}
		fImporter := fileImporter{pgManager}
		helmRepo := &HelmRepo{
			content:      []byte{},
			RepoInternal: repo,
		}
		assert.Err(t, io.EOF, fImporter.fetchAndImportFiles(charts[0].Name, helmRepo, chartVersion))
	})

	t.Run("file not found", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()

		files := models.ChartFiles{
			ID:     chartFilesID,
			Readme: "",
			Values: "",
			Schema: "",
			Repo:   charts[0].Repo,
			Digest: chartVersion.Digest,
		}

		// file does not exist (no rows returned) so insertion goes ahead.
		mock.ExpectQuery(`SELECT EXISTS*`).
			WithArgs(chartFilesID, repo.Name, repo.Namespace, chartVersion.Digest).
			WillReturnRows(sqlmock.NewRows([]string{"info"}))
		mock.ExpectQuery("INSERT INTO files *").
			WithArgs(chartID, repo.Name, repo.Namespace, chartFilesID, files).
			WillReturnRows(sqlmock.NewRows([]string{"ID"}).AddRow("3"))

		netClient = &goodTarballClient{c: charts[0], skipValues: true, skipReadme: true, skipSchema: true}

		fImporter := fileImporter{pgManager}
		helmRepo := &HelmRepo{
			content:      []byte{},
			RepoInternal: repo,
		}
		err := fImporter.fetchAndImportFiles(charts[0].Name, helmRepo, chartVersion)
		assert.NoErr(t, err)
	})

	t.Run("authenticated request", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()

		// file does not exist (no rows returned) so insertion goes ahead.
		mock.ExpectQuery(`SELECT EXISTS*`).
			WithArgs(chartFilesID, repo.Name, repo.Namespace, chartVersion.Digest).
			WillReturnRows(sqlmock.NewRows([]string{"info"}))
		mock.ExpectQuery("INSERT INTO files *").
			WithArgs(chartID, repo.Name, repo.Namespace, chartFilesID, chartFiles).
			WillReturnRows(sqlmock.NewRows([]string{"ID"}).AddRow("3"))

		netClient = &authenticatedTarballClient{c: charts[0]}

		fImporter := fileImporter{pgManager}

		r := &models.RepoInternal{Name: repo.Name, Namespace: repo.Namespace, URL: repo.URL, AuthorizationHeader: "Bearer ThisSecretAccessTokenAuthenticatesTheClient"}
		repo := &HelmRepo{
			RepoInternal: r,
			content:      []byte{},
		}
		err := fImporter.fetchAndImportFiles(charts[0].Name, repo, chartVersion)
		assert.NoErr(t, err)
	})

	t.Run("valid tarball", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()

		mock.ExpectQuery(`SELECT EXISTS*`).
			WithArgs(chartFilesID, repo.Name, repo.Namespace, chartVersion.Digest).
			WillReturnRows(sqlmock.NewRows([]string{"info"}))
		mock.ExpectQuery("INSERT INTO files *").
			WithArgs(chartID, repo.Name, repo.Namespace, chartFilesID, chartFiles).
			WillReturnRows(sqlmock.NewRows([]string{"ID"}).AddRow("3"))

		netClient = &goodTarballClient{c: charts[0]}
		fImporter := fileImporter{pgManager}

		err := fImporter.fetchAndImportFiles(charts[0].Name, fRepo, chartVersion)
		assert.NoErr(t, err)
	})

	t.Run("file exists", func(t *testing.T) {
		pgManager, mock, cleanup := getMockManager(t)
		defer cleanup()

		mock.ExpectQuery(`SELECT EXISTS*`).
			WithArgs(chartFilesID, repo.Name, repo.Namespace, chartVersion.Digest).
			WillReturnRows(sqlmock.NewRows([]string{"info"}).AddRow(`true`))

		fImporter := fileImporter{pgManager}
		err := fImporter.fetchAndImportFiles(charts[0].Name, fRepo, chartVersion)
		assert.NoErr(t, err)
	})
}
