#!/bin/bash
# Copyright (c) 2018 Bitnami
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

CHARTS_REPO="bitnami/charts"
KUBEAPPS_REPO="bitnami/kubeapps"
CHART_REPO_PATH="bitnami/kubeapps"
PROJECT_DIR=`cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null && pwd`
KUBEAPPS_CHART_DIR="${PROJECT_DIR}/chart/kubeapps"
PR_INTERNAL_TEMPLATE_FILE="${PROJECT_DIR}/script/PR_internal_chart_template.md"
PR_EXTERNAL_TEMPLATE_FILE="${PROJECT_DIR}/script/PR_external_chart_template.md"

# Returns the tag for the latest release
latestReleaseTag() {
    local targetRepo=${1:?}
    git -C "${targetRepo}/.git" fetch --tags
    git -C "${targetRepo}/.git" describe --tags $(git rev-list --tags --max-count=1)
    }

changedVersion() {
    local currentVersion=$(cat "${KUBEAPPS_CHART_DIR}/Chart.yaml" | grep "version:")
    local externalVersion=$(curl -s https://raw.githubusercontent.com/${CHARTS_REPO}/master/${CHART_REPO_PATH}/Chart.yaml | grep "version:")
    # NOTE: If curl returns an error this will return always true
    [[ "$currentVersion" != "$externalVersion" ]]
}

configUser() {
    local targetRepo=${1:?}
    local user=${2:?}
    local email=${3:?}
    local gpg=${4:?}
    cd $targetRepo
    git config user.name "$user"
    git config user.email "$email"
    git config user.signingkey "$gpg"
    git config --global commit.gpgSign true
    git config --global tag.gpgSign true
    cd -
}

replaceImage_latestToProduction() {
    local service=${1:?}
    local file=${2:?}
    local repoName="bitnami-docker-kubeapps-${service}"
    local currentImageEscaped="kubeapps\/${service}"
    local targetImageEscaped="bitnami\/kubeapps-${service}"

    echo "Replacing ${service}"...

    local curl_opts=()
    if [[ $GITHUB_TOKEN != "" ]]; then
        curl_opts=(-s -H "Authorization: token ${GITHUB_TOKEN}")
    fi

    # Get the latest tag from the bitnami repository
   local tag=`curl "${curl_opts[@]}" "https://api.github.com/repos/bitnami/${repoName}/tags" | jq -r '.[0].name'`

    if [[ $tag == "" ]]; then
        echo "ERROR: Unable to obtain latest tag for ${repoName}. Aborting"
        exit 1
    fi

    # Replace image and tag from the values.yaml
    sed -i.bk -e '1h;2,$H;$!d;g' -re \
      's/repository: '${currentImageEscaped}'\n    tag: latest/repository: '${targetImageEscaped}'\n    tag: '${tag}'/g' \
      ${file}
    rm "${file}.bk"
}

replaceImage_productionToLatest() {
    local service=${1:?}
    local file=${2:?}
    local targetTag=${3:?}
    local repoName="bitnami-docker-kubeapps-${service}"
    local currentImageEscaped="bitnami\/kubeapps-${service}"
    local targetImageEscaped="kubeapps\/${service}"

    echo "Replacing ${service}"...

    # Replace image and tag from the values.yaml
    sed -i.bk -e '1h;2,$H;$!d;g' -re  \
      's/repository: '${currentImageEscaped}'\n    tag: \S*/repository: '${targetImageEscaped}'\n    tag: latest/g' \
      ${file}
    rm "${file}.bk"
}

updateRepoWithLocalChanges() {
    local targetRepo=${1:?}
    local targetTag=${2:?}
    local targetTagWithoutV=${targetTag#v}
    local targetChartPath="${targetRepo}/${CHART_REPO_PATH}"
    local chartYaml="${targetChartPath}/Chart.yaml"
    if [ ! -f "${chartYaml}" ]; then
        echo "Wrong repo path. You should provide the root of the repository" > /dev/stderr
        return 1
    fi
    rm -rf "${targetChartPath}"
    cp -R "${KUBEAPPS_CHART_DIR}" "${targetChartPath}"
    # Update Chart.yaml with new version
    sed -i.bk 's/appVersion: DEVEL/appVersion: '"${targetTagWithoutV}"'/g' "${chartYaml}"
    rm "${targetChartPath}/Chart.yaml.bk"
    # Replace images for the latest available
    replaceImage_latestToProduction dashboard "${targetChartPath}/values.yaml"
    replaceImage_latestToProduction apprepository-controller "${targetChartPath}/values.yaml"
    replaceImage_latestToProduction asset-syncer "${targetChartPath}/values.yaml"
    replaceImage_latestToProduction assetsvc "${targetChartPath}/values.yaml"
    replaceImage_latestToProduction kubeops "${targetChartPath}/values.yaml"
    replaceImage_latestToProduction pinniped-proxy "${targetChartPath}/values.yaml"
}

updateRepoWithRemoteChanges() {
    local targetRepo=${1:?}
    local targetTag=${2:?}
    local targetTagWithoutV=${targetTag#v}
    local targetChartPath="${targetRepo}/${CHART_REPO_PATH}"
    local remoteChartYaml="${targetChartPath}/Chart.yaml"
    local localChartYaml="${KUBEAPPS_CHART_DIR}/Chart.yaml"
    if [ ! -f "${remoteChartYaml}" ]; then
        echo "Wrong repo path. You should provide the root of the repository" > /dev/stderr
        return 1
    fi
    rm -rf "${KUBEAPPS_CHART_DIR}"
    cp -R "${targetChartPath}" "${KUBEAPPS_CHART_DIR}"
    # Update Chart.yaml with new version
    sed -i.bk "s/appVersion: "${targetTagWithoutV}"/appVersion: DEVEL/g" "${localChartYaml}"
    rm "${KUBEAPPS_CHART_DIR}/Chart.yaml.bk"
    # Replace images for the latest available
    replaceImage_productionToLatest dashboard "${KUBEAPPS_CHART_DIR}/values.yaml" targetTag
    replaceImage_productionToLatest apprepository-controller "${KUBEAPPS_CHART_DIR}/values.yaml" targetTag
    replaceImage_productionToLatest asset-syncer "${KUBEAPPS_CHART_DIR}/values.yaml" targetTag
    replaceImage_productionToLatest assetsvc "${KUBEAPPS_CHART_DIR}/values.yaml" targetTag
    replaceImage_productionToLatest kubeops "${KUBEAPPS_CHART_DIR}/values.yaml" targetTag
    replaceImage_productionToLatest pinniped-proxy "${KUBEAPPS_CHART_DIR}/values.yaml" targetTag
}

commitAndSendExternalPR() {
    local targetRepo=${1:?}
    local targetBranch=${2:-"master"}
    local targetChartPath="${targetRepo}/${CHART_REPO_PATH}"
    local chartYaml="${targetChartPath}/Chart.yaml"
    if [ ! -f "${chartYaml}" ]; then
        echo "Wrong repo path. You should provide the root of the repository" > /dev/stderr
        return 1
    fi
    cd $targetRepo
    if [[ ! $(git diff-index HEAD) ]]; then
        echo "Not found any change to commit" > /dev/stderr
        cd -
        return 1
    fi 
    sed -i.bk -e "s/<USER>/`git config user.name`/g" "${PR_EXTERNAL_TEMPLATE_FILE}"
    sed -i.bk -e "s/<EMAIL>/`git config user.email`/g" "${PR_EXTERNAL_TEMPLATE_FILE}"
    local chartVersion=$(grep -e '^version:' ${chartYaml} | awk '{print $2}')
    git checkout -b $targetBranch
    git add --all .
    git commit -m "kubeapps: bump chart version to $chartVersion"
    # NOTE: This expects to have a loaded SSH key
    git push origin $targetBranch
    git config --local "remote.origin.gh-resolved" ${CHARTS_REPO}
    gh pr create -H $targetBranch -B master -F ${PR_EXTERNAL_TEMPLATE_FILE} --title "[bitnami/kubeapps] Bump chart version to $chartVersion"
    cd -
}

commitAndSendInternalPR() {
    local targetRepo=${1:?}
    local targetBranch=${2:-"master"}
    local targetChartPath="${KUBEAPPS_CHART_DIR}/Chart.yaml"
    local localChartYaml="${KUBEAPPS_CHART_DIR}/Chart.yaml"

    if [ ! -f "${localChartYaml}" ]; then
        echo "Wrong repo path. You should provide the root of the repository" > /dev/stderr
        return 1
    fi
    cd $targetRepo
    if [[ ! $(git diff-index HEAD) ]]; then
        echo "Not found any change to commit" > /dev/stderr
        cd -
        return 1
    fi
    local chartVersion=$(grep -e '^version:' ${localChartYaml} | awk '{print $2}')
    git checkout -b $targetBranch
    git add --all .
    git commit -m "bump chart version to $chartVersion"
    # NOTE: This expects to have a loaded SSH key
    git push origin $targetBranch
    git config --local "remote.origin.gh-resolved" ${KUBEAPPS_REPO}
    gh pr create -H $targetBranch -d -B master -F ${PR_INTERNAL_TEMPLATE_FILE} --title "Sync chart with bitnami/kubeapps chart (version $chartVersion)"
    cd -
}
