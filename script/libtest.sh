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

export TEST_MAX_WAIT_SEC=300

## k8s specific Helper functions

k8s_ensure_image() {
    namespace=${1:?}
    deployment=${2:?}
    expectedPattern=${3:?}
    jsonpath=${4:-'{.spec.template.spec.containers[0].image}'}
    echo "Checking that $deployment mathes $expectedPattern"
    if kubectl get deployment -n $namespace $deployment -o jsonpath="$jsonpath" | grep $expectedPattern; then
        return 0
    else
        echo "Failed to found $expectedPattern"
        return 1
    fi
}

# Waits for the rollout of all the deployments in a provided namespace 
k8s_wait_for_deployments_rollout() {
    namespace=${1:?}
    # Check three times and return the latest result
    for i in {1..3}; do
        res=
        kubectl get deployment -o name --namespace $namespace \
            | xargs -n1 kubectl rollout status --namespace $namespace || res=$?
    done

    return $res
}

# Waits for a set of jobs matching the provided tag to be Completed.
# It retries up to $TEST_MAX_WAIT_SEC
k8s_wait_for_job_completed() {
    namespace=${1:?}
    labelSelector=${2:?}

    local -i retryTimeSeconds=${TEST_MAX_WAIT_SEC:?}
    local -i retryTimeStepSeconds=5


    while [ "$retryTimeSeconds" -gt 0 ]; do
        res=$(kubectl get jobs -n $namespace -l $labelSelector \
        -o jsonpath='{.items[*].status.conditions[?(@.type=="Complete")].status}' | grep "True")
        # There is a job that finished
        if [[ $res ]]; then
            return 0
        fi
        # It did not finished so we reduce the remaining time and wait for next retry cycle
        echo "Waiting for job '${@:2}' to be completed, will retry in $retryTimeStepSeconds seconds ... "
        retryTimeSeconds=retryTimeSeconds-$retryTimeStepSeconds
        sleep $retryTimeStepSeconds
    done

    echo "Job '${@:2}' did not complete"

    return 1
}
