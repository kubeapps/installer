import * as React from "react";

import { IFunction } from "../../shared/types";
import { CardGrid } from "../Card";
import FunctionDeployButton from "./FunctionDeployButton";
import FunctionListItem from "./FunctionListItem";

interface IFunctionListProps {
  functions: IFunction[];
  namespace: string;
  fetchFunctions: (namespace: string) => Promise<any>;
  deployFunction: (n: string, ns: string, spec: IFunction["spec"]) => Promise<any>;
  navigateToFunction: (n: string, ns: string) => any;
}

class FunctionList extends React.Component<IFunctionListProps> {
  public componentDidMount() {
    const { namespace, fetchFunctions } = this.props;
    fetchFunctions(namespace);
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
                deployFunction={this.props.deployFunction}
                navigateToFunction={this.props.navigateToFunction}
              />
            </div>
          </div>
          <hr />
        </header>
        <CardGrid>{chartItems}</CardGrid>
      </section>
    );
  }
}

export default FunctionList;
