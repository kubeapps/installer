import * as React from "react";
import { Link } from "react-router-dom";

import { ForbiddenError, IAppState, IRBACRole } from "../../shared/types";
import { CardGrid } from "../Card";
import { MessageAlert, PermissionsErrorAlert, UnexpectedErrorAlert } from "../ErrorAlert";
import PageHeader from "../PageHeader";
// import SearchFilter from "../SearchFilter";
import AppListItem from "./AppListItem";

interface IAppListProps {
  apps: IAppState;
  fetchApps: (ns: string) => Promise<void>;
  namespace: string;
}

const RequiredRBACRoles: IRBACRole[] = [
  {
    apiGroup: "helm.bitnami.com",
    resource: "helmreleases",
    verbs: ["list"],
  },
  {
    apiGroup: "",
    namespace: "kubeapps",
    resource: "configmaps",
    verbs: ["list"],
  },
];

class AppList extends React.Component<IAppListProps, { error?: boolean }> {
  public state: { error?: boolean } = {};
  public componentDidMount() {
    const { fetchApps, namespace } = this.props;
    fetchApps(namespace);
  }

  public componentWillReceiveProps(nextProps: IAppListProps) {
    const { apps: { error }, fetchApps, namespace } = this.props;
    // refetch if new namespace or error removed due to location change
    if (nextProps.namespace !== namespace || (error && !nextProps.apps.error)) {
      fetchApps(nextProps.namespace);
    }
  }

  public render() {
    const { error, isFetching, items } = this.props.apps;

    return (
      <section className="AppList">
        <PageHeader>
          <div className="col-8">
            <div className="row">
              <h1>Applications</h1>
              {/* <SearchFilter className="margin-l-big" placeholder="search apps..." /> */}
            </div>
          </div>
          {items.length > 0 && (
            <div className="col-4 text-r align-center">
              <Link to="/charts">
                <button className="button button-accent">Deploy App</button>
              </Link>
            </div>
          )}
        </PageHeader>
        <main>
          {isFetching ? (
            <div>Loading</div>
          ) : error ? (
            this.renderError(error)
          ) : (
            this.appListItems(items)
          )}
        </main>
      </section>
    );
  }

  public appListItems(items: IAppState["items"]) {
    if (items.length === 0) {
      return (
        <MessageAlert header="Supercharge your Kubernetes cluster">
          <div>
            <p className="margin-v-normal">
              Deploy applications on your Kubernetes cluster with a single click.
            </p>
            <div className="padding-b-normal">
              <Link className="button button-accent" to="/charts">
                Deploy App
              </Link>
            </div>
          </div>
        </MessageAlert>
      );
    } else {
      return (
        <div>
          <CardGrid>
            {items.map(r => {
              return <AppListItem key={r.data.name} app={r} />;
            })}
          </CardGrid>
        </div>
      );
    }
  }

  private renderError(error: Error) {
    const { namespace } = this.props;
    return error instanceof ForbiddenError ? (
      <PermissionsErrorAlert
        action="list Applications"
        namespace={namespace}
        roles={RequiredRBACRoles}
      />
    ) : (
      <UnexpectedErrorAlert />
    );
  }
}

export default AppList;
