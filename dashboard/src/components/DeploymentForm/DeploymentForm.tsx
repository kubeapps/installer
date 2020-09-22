import { RouterAction } from "connected-react-router";
import * as Moniker from "moniker-native";
import React, { useEffect, useState } from "react";

import { JSONSchema4 } from "json-schema";
import { IChartState, IChartVersion } from "../../shared/types";
import * as url from "../../shared/url";
import DeploymentFormBody from "../DeploymentFormBody/DeploymentFormBody";
import LoadingWrapper from "../LoadingWrapper/LoadingWrapper";

import actions from "actions";
import ChartSummary from "components/Catalog/ChartSummary";
import ChartHeader from "components/ChartView/ChartHeader";
import Alert from "components/js/Alert";
import Column from "components/js/Column";
import Row from "components/js/Row";
import { useDispatch } from "react-redux";
import "react-tabs/style/react-tabs.css";
import { definedNamespaces } from "shared/Namespace";

export interface IDeploymentFormProps {
  chartNamespace: string;
  cluster: string;
  chartID: string;
  chartVersion: string;
  error: Error | undefined;
  chartsIsFetching: boolean;
  selected: IChartState["selected"];
  deployChart: (
    targetCluster: string,
    targetNamespace: string,
    version: IChartVersion,
    chartNamespace: string,
    releaseName: string,
    values?: string,
    schema?: JSONSchema4,
  ) => Promise<boolean>;
  push: (location: string) => RouterAction;
  fetchChartVersions: (cluster: string, namespace: string, id: string) => Promise<IChartVersion[]>;
  getChartVersion: (cluster: string, namespace: string, id: string, chartVersion: string) => void;
  namespace: string;
}

function DeploymentForm({
  chartNamespace,
  cluster,
  chartID,
  chartVersion,
  error,
  chartsIsFetching,
  selected,
  deployChart,
  push,
  fetchChartVersions,
  namespace,
}: IDeploymentFormProps) {
  const [isDeploying, setDeploying] = useState(false);
  const [releaseName, setReleaseName] = useState(Moniker.choose());
  const [appValues, setAppValues] = useState(selected.values || "");
  const [valuesModified, setValuesModified] = useState(false);
  const { version } = selected;
  const dispatch = useDispatch();

  useEffect(() => {
    fetchChartVersions(cluster, chartNamespace, chartID);
  }, [fetchChartVersions, cluster, chartNamespace, chartID]);

  useEffect(() => {
    if (!valuesModified) {
      setAppValues(selected.values || "");
    }
  }, [selected.values, valuesModified]);
  useEffect(() => {
    dispatch(actions.charts.getChartVersion(cluster, chartNamespace, chartID, chartVersion));
  }, [cluster, chartNamespace, chartID, chartVersion, dispatch]);

  const handleValuesChange = (value: string) => {
    setAppValues(value);
  };

  const setValuesModifiedTrue = () => {
    setValuesModified(true);
  };

  const handleReleaseNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    setReleaseName(e.currentTarget.value);
  };

  const handleDeploy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDeploying(true);
    if (selected.version) {
      const deployed = await deployChart(
        cluster,
        namespace,
        selected.version,
        chartNamespace,
        releaseName,
        appValues,
        selected.schema,
      );
      setDeploying(false);
      if (deployed) {
        push(url.app.apps.get(cluster, namespace, releaseName));
      }
    }
  };

  const selectVersion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    push(url.app.apps.new(cluster, namespace, selected.version!, e.currentTarget.value));
  };

  if (!version) {
    return <LoadingWrapper />;
  }
  const chartAttrs = version.relationships.chart.data;
  return (
    <section>
      <ChartHeader
        chartAttrs={chartAttrs}
        versions={selected.versions}
        onSelect={selectVersion}
        selectedVersion={selected.version?.attributes.version}
      />
      {isDeploying && (
        <h3 className="center" style={{ marginBottom: "1.2rem" }}>
          Hang tight, the application is being deployed...
        </h3>
      )}
      <LoadingWrapper loaded={!isDeploying}>
        <Row>
          <Column span={3}>
            <ChartSummary version={version} chartAttrs={chartAttrs} />
          </Column>
          <Column span={9}>
            {error && <Alert theme="danger">An error occurred: {error.message}</Alert>}
            {namespace === definedNamespaces.all ? (
              <Alert theme="danger">
                Namespace not selected. Please select a namespace using the selector in the top
                right corner.
              </Alert>
            ) : (
              <form onSubmit={handleDeploy}>
                <div>
                  <label
                    htmlFor="releaseName"
                    className="deployment-form-label deployment-form-label-text-param"
                  >
                    Name
                  </label>
                  <input
                    id="releaseName"
                    pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*"
                    title="Use lower case alphanumeric characters, '-' or '.'"
                    className="clr-input deployment-form-text-input"
                    onChange={handleReleaseNameChange}
                    value={releaseName}
                    required={true}
                  />
                </div>
                <DeploymentFormBody
                  deploymentEvent="install"
                  chartID={chartID}
                  chartVersion={chartVersion}
                  chartsIsFetching={chartsIsFetching}
                  selected={selected}
                  setValues={handleValuesChange}
                  appValues={appValues}
                  setValuesModified={setValuesModifiedTrue}
                />
              </form>
            )}
          </Column>
        </Row>
      </LoadingWrapper>
    </section>
  );
}

export default DeploymentForm;
