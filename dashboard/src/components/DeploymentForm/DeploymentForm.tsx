import * as React from "react";
import AceEditor from "react-ace";
import { RouterAction } from "react-router-redux";

import { IServiceBinding } from "../../shared/ServiceBinding";
import { IChartState, IChartVersion, IHelmRelease } from "../../shared/types";

import "brace/mode/yaml";
import "brace/theme/xcode";

interface IDeploymentFormProps {
  hr?: IHelmRelease;
  bindings: IServiceBinding[];
  chartID: string;
  chartVersion: string;
  selected: IChartState["selected"];
  deployChart: (
    version: IChartVersion,
    releaseName: string,
    namespace: string,
    values?: string,
    resourceVersion?: string,
  ) => Promise<{}>;
  push: (location: string) => RouterAction;
  fetchChartVersions: (id: string) => Promise<{}>;
  getBindings: () => Promise<IServiceBinding[]>;
  getChartVersion: (id: string, chartVersion: string) => Promise<{}>;
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
  error?: string;
  selectedBinding: IServiceBinding | undefined;
}

class DeploymentForm extends React.Component<IDeploymentFormProps, IDeploymentFormState> {
  public state: IDeploymentFormState = {
    appValues: undefined,
    error: undefined,
    isDeploying: false,
    namespace: "default",
    releaseName: "",
    selectedBinding: undefined,
    valuesModified: false,
  };

  public componentDidMount() {
    const {
      hr,
      chartID,
      fetchChartVersions,
      getBindings,
      getChartVersion,
      chartVersion,
      namespace,
    } = this.props;
    fetchChartVersions(chartID);
    getBindings();
    getChartVersion(chartID, chartVersion);

    if (hr) {
      this.setState({
        namespace: hr.metadata.namespace,
        releaseName: hr.metadata.name,
      });
    } else {
      this.setState({
        namespace,
      });
    }
  }

  public componentWillReceiveProps(nextProps: IDeploymentFormProps) {
    const { chartID, chartVersion, getChartValues, getChartVersion, hr, selected } = this.props;
    const { version } = selected;

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
        if (hr && hr.spec.version === version.attributes.version) {
          this.setState({ appValues: hr.spec.values });
        } else if (nextProps.selected.values) {
          this.setState({ appValues: nextProps.selected.values });
        }
      }
    }
  }

  public render() {
    const { hr, selected, bindings } = this.props;
    const { version, versions } = selected;
    const { appValues, selectedBinding } = this.state;
    if (!version || !versions.length) {
      return <div>Loading</div>;
    }
    let bindingDetail = <div />;
    if (selectedBinding) {
      const {
        instanceRef,
        secretName,
        secretDatabase,
        secretHost,
        secretPassword,
        secretPort,
        secretUsername,
      } = selectedBinding.spec;

      const statuses: Array<[string, string | undefined]> = [
        ["Instance", instanceRef.name],
        ["Secret", secretName],
        ["Database", secretDatabase],
        ["Host", secretHost],
        ["Password", secretPassword],
        ["Port", secretPort],
        ["Username", secretUsername],
      ];

      bindingDetail = (
        <dl className="container margin-normal">
          {statuses.map(statusPair => {
            const [key, value] = statusPair;
            return [
              <dt key={key}>{key}</dt>,
              <dd key={value}>
                <code>{value}</code>
              </dd>,
            ];
          })}
        </dl>
      );
    }

    return (
      <div>
        {this.state.error && (
          <div className="padding-big margin-b-big bg-action">{this.state.error}</div>
        )}
        <form className="container padding-b-bigger" onSubmit={this.handleDeploy}>
          <div className="row">
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
                  disabled={hr ? true : false}
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
                      {hr && v.attributes.version === hr.spec.version ? "(current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="namespace">Namespace</label>
                <input
                  name="namespace"
                  onChange={this.handleNamespaceChange}
                  value={this.state.namespace}
                  required={true}
                  // this is now fixed due to state & URL
                  disabled={true}
                />
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
              {bindings.length > 0 && (
                <div>
                  <p>[Optional] Select a service binding for your new app</p>
                  <label htmlFor="bindings">Bindings</label>
                  <select onChange={this.onBindingChange}>
                    <option key="none" value="none">
                      {" "}
                      -- Select one --
                    </option>
                    {bindings.map(b => (
                      <option
                        key={b.metadata.name}
                        selected={
                          b.metadata.name === (selectedBinding && selectedBinding.metadata.name)
                        }
                        value={b.metadata.name}
                      >
                        {b.metadata.name}
                      </option>
                    ))}
                  </select>
                  {bindingDetail}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }

  public onBindingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({
      selectedBinding:
        this.props.bindings.find(binding => binding.metadata.name === e.target.value) || undefined,
    });
  };

  public handleDeploy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { selected, deployChart, push, hr } = this.props;
    const resourceVersion = hr ? hr.metadata.resourceVersion : undefined;
    this.setState({ isDeploying: true });
    const { releaseName, namespace, appValues } = this.state;
    if (selected.version) {
      deployChart(selected.version, releaseName, namespace, appValues, resourceVersion)
        .then(() => push(`/apps/ns/${namespace}/${namespace}-${releaseName}`))
        .catch(err => this.setState({ isDeploying: false, error: err.toString() }));
    }
  };

  public handleReleaseNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.setState({ releaseName: e.currentTarget.value });
  };
  public handleChartVersionChange = (e: React.FormEvent<HTMLSelectElement>) => {
    const { hr, chartID, getChartVersion } = this.props;

    if (hr) {
      getChartVersion(chartID, e.currentTarget.value);
    } else {
      this.props.push(`/apps/new/${this.props.chartID}/versions/${e.currentTarget.value}`);
    }
  };
  public handleNamespaceChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.setState({ namespace: e.currentTarget.value });
  };
  public handleValuesChange = (value: string) => {
    this.setState({ appValues: value, valuesModified: true });
  };
}

export default DeploymentForm;
