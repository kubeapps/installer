import * as React from "react";
import AceEditor from "react-ace";
import { RouterAction } from "react-router-redux";

import { IServiceBindingWithSecret } from "../../shared/ServiceBinding";
import { IChartState, IChartVersion } from "../../shared/types";
import DeploymentBinding from "../DeploymentForm/DeploymentBinding";
import DeploymentErrors from "../DeploymentForm/DeploymentErrors";

import "brace/mode/yaml";
import "brace/theme/xcode";

interface IDeploymentFormProps {
  appCurrentVersion: string;
  appCurrentValues?: string;
  bindingsWithSecrets: IServiceBindingWithSecret[];
  chartName: string;
  kubeappsNamespace: string;
  namespace: string;
  releaseName: string;
  repo: string;
  error: Error | undefined;
  selected: IChartState["selected"];
  upgradeApp: (
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
  clearRepo: () => any;
}

interface IDeploymentFormState {
  appValues?: string;
  isDeploying: boolean;
  valuesModified: boolean;
  version: string;
}

class UpgradeForm extends React.Component<IDeploymentFormProps, IDeploymentFormState> {
  public state: IDeploymentFormState = {
    appValues: this.props.appCurrentValues,
    isDeploying: false,
    valuesModified: false,
    version: this.props.appCurrentVersion,
  };

  public componentDidMount() {
    const {
      appCurrentVersion,
      chartName,
      fetchChartVersions,
      getBindings,
      getChartVersion,
      namespace,
      repo,
    } = this.props;
    const chartID = `${repo}/${chartName}`;
    fetchChartVersions(chartID);
    getChartVersion(chartID, appCurrentVersion);
    getBindings(namespace);
  }

  public componentDidUpdate(prevProps: IDeploymentFormProps) {
    const { selected, appCurrentVersion, appCurrentValues } = this.props;
    if (
      selected.version &&
      prevProps.selected.version &&
      selected.version !== prevProps.selected.version
    ) {
      // Version has changed
      if (selected.version.attributes.version === appCurrentVersion) {
        // The user has selected back the original version, use the current values
        if (!this.state.valuesModified) {
          // Only update the default values if the user has not modify them
          this.setState({ appValues: appCurrentValues });
        }
      }
    }
    if (selected.values && this.state.appValues && selected.values !== this.state.appValues) {
      // Values has been modified either because the user has edit them
      // or because the selected version is now different
      if (!this.state.valuesModified) {
        // Only update the default values if the user has not modify them
        if (this.state.version !== appCurrentVersion) {
          // Only use the default values if the version is not the original one
          this.setState({ appValues: selected.values });
        }
      }
    }
  }

  public render() {
    const { selected, bindingsWithSecrets, appCurrentVersion } = this.props;
    const { version, versions } = selected;
    const { appValues } = this.state;
    if (this.props.error) {
      return <DeploymentErrors {...this.props} version={appCurrentVersion} />;
    }
    if (!version || !versions || !versions.length || this.state.isDeploying) {
      return <div> Loading </div>;
    }
    return (
      <div>
        <form className="container padding-b-bigger" onSubmit={this.handleDeploy}>
          <div className="row">
            <div className="col-8">
              {this.props.error && (
                <DeploymentErrors {...this.props} version={version.attributes.version} />
              )}
            </div>
            <div className="col-12">
              <h2>
                {this.props.releaseName} ({this.props.chartName})
              </h2>
            </div>
            <div className="col-8">
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
                      {v.attributes.version === this.props.appCurrentVersion ? "(current)" : ""}
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
                <button className="button" onClick={this.handleReselectChartRepo}>
                  Back
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
    const { releaseName, namespace, selected, upgradeApp, push } = this.props;
    this.setState({ isDeploying: true });
    const { appValues } = this.state;
    if (selected.version) {
      const deployed = await upgradeApp(selected.version, releaseName, namespace, appValues);
      this.setState({ isDeploying: false });
      if (deployed) {
        push(`/apps/ns/${namespace}/${releaseName}`);
      }
    }
  };

  public handleChartVersionChange = (e: React.FormEvent<HTMLSelectElement>) => {
    const { repo, chartName, getChartVersion, getChartValues } = this.props;
    const chartID = `${repo}/${chartName}`;
    this.setState({ version: e.currentTarget.value });
    getChartVersion(chartID, e.currentTarget.value);
    if (!this.state.valuesModified) {
      // Only update the default values if the user has not modify them
      getChartValues(chartID, e.currentTarget.value);
    }
  };

  public handleValuesChange = (value: string) => {
    this.setState({ appValues: value, valuesModified: true });
  };

  public handleReselectChartRepo = () => {
    this.props.clearRepo();
  };
}

export default UpgradeForm;
