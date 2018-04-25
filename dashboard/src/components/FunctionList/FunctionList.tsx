import * as React from "react";

import { ForbiddenError, IFunction, IRBACRole, IRuntime } from "../../shared/types";
import { CardGrid } from "../Card";
import { PermissionsErrorAlert, UnexpectedErrorAlert } from "../ErrorAlert";
import FunctionDeployButton from "./FunctionDeployButton";
import FunctionListItem from "./FunctionListItem";

interface IFunctionListProps {
  functions: IFunction[];
  runtimes: IRuntime[];
  fetchRuntimes: () => Promise<any>;
  createError: Error;
  error: Error;
  fetchFunctions: (namespace: string) => Promise<any>;
  deployFunction: (n: string, ns: string, spec: IFunction["spec"]) => Promise<boolean>;
  namespace: string;
  navigateToFunction: (n: string, ns: string) => any;
}

const RequiredRBACRoles: IRBACRole[] = [
  {
    apiGroup: "kubeless.io",
    resource: "functions",
    verbs: ["list"],
  },
];

class FunctionList extends React.Component<IFunctionListProps> {
  public componentDidMount() {
    const { fetchFunctions, fetchRuntimes, namespace } = this.props;
    fetchFunctions(namespace);
    fetchRuntimes();
  }

  public componentWillReceiveProps(nextProps: IFunctionListProps) {
    const { error, fetchFunctions, namespace } = this.props;
    // refetch if new namespace or error removed due to location change
    if (nextProps.namespace !== namespace || (error && !nextProps.error)) {
      fetchFunctions(nextProps.namespace);
    }
  }

  public render() {
    const chartItems = this.props.functions.map(f => (
      <FunctionListItem key={`${f.metadata.namespace}/${f.metadata.name}`} function={f} />
    ));
    return (
      <section className="FunctionList">
        <header className="FunctionList__header">
          <div className="row padding-t-big collapse-b-phone-land">
            <div className="col-8">
              <h1 className="margin-v-reset">Functions</h1>
            </div>
            <div className="col-4 text-r align-center">
              <FunctionDeployButton
                error={this.props.createError}
                deployFunction={this.props.deployFunction}
                navigateToFunction={this.props.navigateToFunction}
                runtimes={this.props.runtimes}
                namespace={this.props.namespace}
              />
            </div>
          </div>
          <hr />
        </header>
        {this.props.error ? this.renderError() : <CardGrid>{chartItems}</CardGrid>}
      </section>
    );
  }

  private renderError() {
    const { error, namespace } = this.props;
    return error instanceof ForbiddenError ? (
      <PermissionsErrorAlert
        action="list Functions"
        namespace={namespace}
        roles={RequiredRBACRoles}
      />
    ) : (
      <UnexpectedErrorAlert />
    );
  }
}

export default FunctionList;
