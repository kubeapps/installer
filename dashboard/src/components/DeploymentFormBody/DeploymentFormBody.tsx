import { RouterAction } from "connected-react-router";
import * as jsonpatch from "fast-json-patch";
import * as React from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import * as YAML from "yaml";

import { deleteValue, retrieveBasicFormParams, setValue } from "../../shared/schema";
import { IBasicFormParam, IChartState } from "../../shared/types";
import { getValueFromEvent } from "../../shared/utils";
import ConfirmDialog from "../ConfirmDialog";
import { ErrorSelector } from "../ErrorAlert";
import Hint from "../Hint";
import LoadingWrapper from "../LoadingWrapper";
import AdvancedDeploymentForm from "./AdvancedDeploymentForm";
import BasicDeploymentForm from "./BasicDeploymentForm";

import "react-tabs/style/react-tabs.css";
import "./Tabs.css";

export interface IDeploymentFormBodyProps {
  chartID: string;
  chartVersion: string;
  deployedValues?: string;
  namespace: string;
  releaseName?: string;
  selected: IChartState["selected"];
  appValues: string;
  valuesModified: boolean;
  push: (location: string) => RouterAction;
  goBack?: () => RouterAction;
  fetchChartVersions: (id: string) => void;
  getChartVersion: (id: string, chartVersion: string) => void;
  setValues: (values: string) => void;
  setValuesModified: () => void;
}

export interface IDeploymentFormBodyState {
  basicFormParameters: IBasicFormParam[];
  restoreDefaultValuesModalIsOpen: boolean;
  modifications?: jsonpatch.Operation[];
}

class DeploymentFormBody extends React.Component<
  IDeploymentFormBodyProps,
  IDeploymentFormBodyState
> {
  public state: IDeploymentFormBodyState = {
    basicFormParameters: [],
    restoreDefaultValuesModalIsOpen: false,
  };

  public componentDidMount() {
    const { chartID, fetchChartVersions, getChartVersion, chartVersion } = this.props;
    fetchChartVersions(chartID);
    getChartVersion(chartID, chartVersion);
  }

  public componentWillReceiveProps = (nextProps: IDeploymentFormBodyProps) => {
    const { chartID, chartVersion, getChartVersion } = this.props;

    if (chartVersion !== nextProps.chartVersion) {
      // New version detected
      getChartVersion(chartID, nextProps.chartVersion);
      return;
    }

    if (nextProps.selected !== this.props.selected) {
      // The values or the schema has changed
      let values = "";
      // Get the original modification to the values if exists
      let modifications = this.state.modifications;
      // TODO(andresmgot): Right now, are taking advantage of the fact that when first
      // loaded this component (in the upgrade scenario) the "selected" version is the
      // currently deployed version. We should change that to be the latest version available
      // so the current approach won't be possible. We should also try to avoid to modify
      // the behavior of this component depending on the scenario (install/upgrade).
      if (nextProps.selected.values && this.props.deployedValues && !modifications) {
        const defaultValuesObj = YAML.parse(nextProps.selected.values);
        const deployedValuesObj = YAML.parse(this.props.deployedValues);
        modifications = jsonpatch.compare(defaultValuesObj, deployedValuesObj);
        this.setState({ modifications });
      }

      if (!this.props.valuesModified) {
        // In other case, use the default values for the selected version
        values = nextProps.selected.values || "";
        // And we add any possible change made to the original version
        if (modifications) {
          modifications.forEach(modification => {
            // Transform the JSON Path to the format expected by setValue
            // /a/b/c => a.b.c
            const path = modification.path.replace(/^\//, "").replace(/\//g, ".");
            if (modification.op === "remove") {
              values = deleteValue(values, path);
            } else {
              // Transform the modification as a ReplaceOperation to read its value
              const value = (modification as jsonpatch.ReplaceOperation<any>).value;
              values = setValue(values, path, value);
            }
          });
        }
        this.props.setValues(values);
      } else {
        // If the user has modified the values, use the ones defined
        values = this.props.appValues;
      }
      if (nextProps.selected.schema) {
        this.setState({
          basicFormParameters: retrieveBasicFormParams(values, nextProps.selected.schema),
        });
      }
      return;
    }
  };

  public render() {
    const { selected, chartID, chartVersion, goBack, appValues } = this.props;
    const { version, versions } = selected;
    if (selected.error) {
      return (
        <ErrorSelector error={selected.error} resource={`Chart "${chartID}" (${chartVersion})`} />
      );
    }
    if (!version || !versions.length) {
      return <LoadingWrapper />;
    }
    return (
      <div>
        <ConfirmDialog
          modalIsOpen={this.state.restoreDefaultValuesModalIsOpen}
          loading={false}
          confirmationText={"Are you sure you want to restore the default chart values?"}
          confirmationButtonText={"Restore"}
          onConfirm={this.restoreDefaultValues}
          closeModal={this.closeRestoreDefaultValuesModal}
        />
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
                {this.props.releaseName && v.attributes.version === this.props.chartVersion
                  ? "(current)"
                  : ""}
              </option>
            ))}
          </select>
        </div>
        {this.shouldRenderBasicForm() ? (
          this.renderTabs()
        ) : (
          <AdvancedDeploymentForm
            appValues={appValues}
            handleValuesChange={this.handleValuesChange}
          />
        )}
        <div className="margin-t-big">
          <button className="button button-primary" type="submit">
            Submit
          </button>
          <button className="button" type="button" onClick={this.openRestoreDefaultValuesModal}>
            Restore Chart Defaults
          </button>
          {goBack && (
            <button className="button" type="button" onClick={goBack}>
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  private handleChartVersionChange = (e: React.FormEvent<HTMLSelectElement>) => {
    // TODO(andres): This requires refactoring. Currently, the deploy and upgrade
    // forms behave differently. In the deployment form, a change in the version
    // changes the route but in the case of the upgrade it only changes the state
    const isUpgradeForm = !!this.props.releaseName;

    if (isUpgradeForm) {
      const { chartID, getChartVersion } = this.props;
      getChartVersion(chartID, e.currentTarget.value);
    } else {
      this.props.push(
        `/apps/ns/${this.props.namespace}/new/${this.props.chartID}/versions/${
          e.currentTarget.value
        }`,
      );
    }
  };

  private handleValuesChange = (value: string) => {
    this.props.setValues(value);
    this.props.setValuesModified();
  };

  private refreshBasicParameters = () => {
    this.setState({
      basicFormParameters: retrieveBasicFormParams(
        this.props.appValues,
        this.props.selected.schema,
      ),
    });
  };

  private renderTabs = () => {
    return (
      <div className="margin-t-normal">
        <Tabs>
          <TabList>
            <Tab onClick={this.refreshBasicParameters}>
              Basic{" "}
              <Hint reactTooltipOpts={{ delayHide: 100 }} id="basicFormHelp">
                <span>
                  This form has been automatically generated based on the chart schema.
                  <br />
                  This feature is currently in a beta state. If you find an issue please report it{" "}
                  <a target="_blank" href="https://github.com/kubeapps/kubeapps/issues/new">
                    here.
                  </a>
                </span>
              </Hint>
            </Tab>
            <Tab>Advanced</Tab>
          </TabList>
          <TabPanel>
            <BasicDeploymentForm
              params={this.state.basicFormParameters}
              handleBasicFormParamChange={this.handleBasicFormParamChange}
              appValues={this.props.appValues}
              handleValuesChange={this.handleValuesChange}
            />
          </TabPanel>
          <TabPanel>
            <AdvancedDeploymentForm
              appValues={this.props.appValues}
              handleValuesChange={this.handleValuesChange}
            />
          </TabPanel>
        </Tabs>
      </div>
    );
  };

  private handleBasicFormParamChange = (param: IBasicFormParam) => {
    return (e: React.FormEvent<HTMLInputElement>) => {
      this.props.setValuesModified();
      const value = getValueFromEvent(e);
      this.setState({
        // Change param definition
        basicFormParameters: this.state.basicFormParameters.map(p =>
          p.path === param.path ? { ...param, value } : p,
        ),
      });
      // Change raw values
      this.props.setValues(setValue(this.props.appValues, param.path, value));
    };
  };

  // The basic form should be rendered if there are params to show
  private shouldRenderBasicForm = () => {
    return Object.keys(this.state.basicFormParameters).length > 0;
  };

  private closeRestoreDefaultValuesModal = () => {
    this.setState({ restoreDefaultValuesModalIsOpen: false });
  };

  private openRestoreDefaultValuesModal = () => {
    this.setState({ restoreDefaultValuesModalIsOpen: true });
  };

  private restoreDefaultValues = () => {
    if (this.props.selected.values) {
      this.props.setValues(this.props.selected.values);
      this.setState({
        basicFormParameters: retrieveBasicFormParams(
          this.props.selected.values,
          this.props.selected.schema,
        ),
      });
    }
    this.setState({ restoreDefaultValuesModalIsOpen: false });
  };
}

export default DeploymentFormBody;
