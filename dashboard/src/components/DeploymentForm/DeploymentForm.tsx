import * as React from "react";
import AceEditor from "react-ace";
import { RouterAction } from "react-router-redux";

import { IServiceBindingWithSecret } from "../../shared/ServiceBinding";
import { IChartState, IChartVersion } from "../../shared/types";
import DeploymentBinding from "./DeploymentBinding";
import DeploymentErrors from "./DeploymentErrors";

import "brace/mode/yaml";
import "brace/theme/xcode";

interface IDeploymentFormProps {
  kubeappsNamespace: string;
  bindingsWithSecrets: IServiceBindingWithSecret[];
  chartID: string;
  chartVersion: string;
  error: Error | undefined;
  selected: IChartState["selected"];
  deployChart: (
    version: IChartVersion,
    releaseName: string,
    namespace: string,
    values?: string,
  ) => Promise<boolean>;
  push: (location: string) => RouterAction;
  fetchChartVersions: (id: string) => Promise<{}>;
  getBindings: (ns: string) => Promise<IServiceBindingWithSecret[]>;
  getChartVersion: (id: string, chartVersion: string) => Promise<void>;
  getChartValues: (id: string, chartVersion: string) => Promise<any>;
  namespace: string;
}

interface IDeploymentFormState {
  isDeploying: boolean;
  // deployment options
  releaseName: string;
  namespace: string;
  appValues?: string;
  valuesModified: boolean;
}

class DeploymentForm extends React.Component<IDeploymentFormProps, IDeploymentFormState> {
  public state: IDeploymentFormState = {
    appValues: undefined,
    isDeploying: false,
    namespace: this.props.namespace,
    releaseName: "",
    valuesModified: false,
  };

  public componentDidMount() {
    const {
      chartID,
      fetchChartVersions,
      getChartVersion,
      chartVersion,
      getBindings,
      namespace,
    } = this.props;
    fetchChartVersions(chartID);
    getChartVersion(chartID, chartVersion);
    getBindings(namespace);
  }

  public componentWillReceiveProps(nextProps: IDeploymentFormProps) {
    const {
      chartID,
      chartVersion,
      getBindings,
      getChartValues,
      getChartVersion,
      namespace,
      selected,
    } = this.props;
    const { version } = selected;

    if (nextProps.namespace !== namespace) {
      this.setState({ namespace: nextProps.namespace });
      getBindings(nextProps.namespace);
      return;
    }

    if (chartVersion !== nextProps.chartVersion) {
      getChartVersion(chartID, nextProps.chartVersion);
      return;
    }

    if (nextProps.selected.version && nextProps.selected.version !== this.props.selected.version) {
      getChartValues(chartID, nextProps.selected.version.attributes.version);
      return;
    }

    if (!this.state.valuesModified) {
      if (version) {
        this.setState({ appValues: nextProps.selected.values });
      }
    }
  }

  public render() {
    const { selected, bindingsWithSecrets, chartID, kubeappsNamespace } = this.props;
    const { version, versions } = selected;
    const { appValues, releaseName } = this.state;
    if (!version || !versions.length || this.state.isDeploying) {
      return <div>Loading</div>;
    }
    return (
      <div>
        <form className="container padding-b-bigger" onSubmit={this.handleDeploy}>
          <div className="row">
            <div className="col-8">
              {this.props.error && (
                <DeploymentErrors
                  {...this.props}
                  kubeappsNamespace={kubeappsNamespace}
                  chartName={chartID.split("/")[0]}
                  releaseName={releaseName}
                  repo={chartID.split("/")[1]}
                  version={version.attributes.version}
                />
              )}
            </div>
            <div className="col-12">
              <h2>{this.props.chartID}</h2>
            </div>
            <div className="col-8">
              <div>
                <label htmlFor="releaseName">Name</label>
                <input
                  id="releaseName"
                  onChange={this.handleReleaseNameChange}
                  value={this.state.releaseName}
                  required={true}
                />
              </div>
              <div>
                <label htmlFor="chartVersion">Version</label>
                <select
                  id="chartVersion"
                  onChange={this.handleChartVersionChange}
                  value={version.attributes.version}
                  required={true}
                >
                  {versions.map(v => (
                    <option key={v.id} value={v.attributes.version}>
                      {v.attributes.version}{" "}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1em" }}>
                <label htmlFor="values">Values (YAML)</label>
                <AceEditor
                  mode="yaml"
                  theme="xcode"
                  name="values"
                  width="100%"
                  onChange={this.handleValuesChange}
                  setOptions={{ showPrintMargin: false }}
                  editorProps={{ $blockScrolling: Infinity }}
                  value={appValues}
                />
              </div>
              <div>
                <button className="button button-primary" type="submit">
                  Submit
                </button>
              </div>
            </div>
            <div className="col-4">
              {bindingsWithSecrets.length > 0 && (
                <DeploymentBinding bindingsWithSecrets={bindingsWithSecrets} />
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }

  public handleDeploy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { selected, deployChart, push } = this.props;
    this.setState({ isDeploying: true });
    const { releaseName, namespace, appValues } = this.state;
    if (selected.version) {
      const deployed = await deployChart(selected.version, releaseName, namespace, appValues);
      if (deployed) {
        push(`/apps/ns/${namespace}/${releaseName}`);
      } else {
        this.setState({ isDeploying: false });
      }
    }
  };

  public handleReleaseNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.setState({ releaseName: e.currentTarget.value });
  };
  public handleChartVersionChange = (e: React.FormEvent<HTMLSelectElement>) => {
    this.props.push(
      `/apps/ns/${this.props.namespace}/new/${this.props.chartID}/versions/${
        e.currentTarget.value
      }`,
    );
  };
  public handleValuesChange = (value: string) => {
    this.setState({ appValues: value, valuesModified: true });
  };
}

export default DeploymentForm;
