import { IAuthState } from "../reducers/auth";
import { IServiceCatalogState } from "../reducers/catalog";
import { IConfigState } from "../reducers/config";
import { IFunctionState } from "../reducers/functions";
import { INamespaceState } from "../reducers/namespace";
import { IAppRepositoryState } from "../reducers/repos";
import { hapi } from "./hapi/release";

// Allow defining multiple error classes
// tslint:disable:max-classes-per-file
export class ForbiddenError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MissingChart extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AppConflict extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface IRepo {
  name: string;
  url: string;
}

export interface IChartVersion {
  id: string;
  attributes: IChartVersionAttributes;
  relationships: {
    chart: {
      data: IChartAttributes;
    };
  };
}

export interface IChartVersionAttributes {
  version: string;
  app_version: string;
  created: string;
}

export interface IChart {
  id: string;
  attributes: IChartAttributes;
  relationships: {
    latestChartVersion: {
      data: IChartVersionAttributes;
    };
  };
}

export interface IChartAttributes {
  name: string;
  description: string;
  home?: string;
  icon?: string;
  keywords: string[];
  maintainers: Array<{
    name: string;
    email?: string;
  }>;
  repo: IRepo;
  sources: string[];
}

export interface IChartState {
  isFetching: boolean;
  selected: {
    error?: Error;
    version?: IChartVersion;
    versions: IChartVersion[];
    readme?: string;
    readmeError?: string;
    values?: string;
  };
  items: IChart[];
}

export interface IDeployment {
  metadata: {
    name: string;
    namespace: string;
  };
}

export interface IServiceSpec {
  ports: IPort[];
  clusterIP: string;
  type: string;
}

export interface IServiceStatus {
  loadBalancer: {
    ingress?: Array<{ ip: string }>;
  };
}

export interface IPort {
  name: string;
  port: number;
  protocol: string;
  targetPort: string;
  nodePort: string;
}

export interface IResource {
  apiVersion: string;
  kind: string;
  type: string;
  spec: any;
  status: any;
  metadata: {
    name: string;
    namespace: string;
    annotations: string;
    creationTimestamp: string;
    selfLink: string;
    resourceVersion: string;
    deletionTimestamp?: string;
    uid: string;
  };
}

export interface IOwnerReference {
  apiVersion: string;
  blockOwnerDeletion: boolean;
  kind: string;
  name: string;
  uid: string;
}

export interface ISecret extends IResource {
  data: { [s: string]: string };
}

export interface IDeploymentStatus {
  replicas: number;
  updatedReplicas: number;
  availableReplicas: number;
}

export interface IFunction extends IResource {
  spec: {
    deps: string;
    function: string;
    handler: string;
    runtime: string;
    checksum: string;
  };
}

export interface IAppState {
  isFetching: boolean;
  error?: Error;
  deleteError?: Error;
  // currently items are always Helm releases
  items: hapi.release.Release[];
  listOverview?: IAppOverview[];
  selected?: hapi.release.Release;
}

export interface IStoreState {
  catalog: IServiceCatalogState;
  apps: IAppState;
  auth: IAuthState;
  charts: IChartState;
  config: IConfigState;
  repos: IAppRepositoryState;
  deployment: IDeployment;
  functions: IFunctionState;
  namespace: INamespaceState;
}

interface IK8sResource {
  apiVersion: string;
  kind: string;
}

/** @see https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#objects */
export interface IK8sObject<M, SP, ST> extends IK8sResource {
  metadata: {
    annotations?: { [key: string]: string };
    creationTimestamp?: string;
    deletionTimestamp?: string | null;
    generation?: number;
    labels?: { [key: string]: string };
    name: string;
    namespace: string;
    resourceVersion?: string;
    uid: string;
    selfLink?: string; // Not in docs, but seems to exist everywhere
  } & M;
  spec?: SP;
  status?: ST;
}

/** @see https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#lists-and-simple-kinds */
export interface IK8sList<I, M> extends IK8sResource {
  items: I[];
  metadata?: {
    resourceVersion?: string;
    selfLink?: string; // Not in docs, but seems to exist everywhere
  } & M;
}

export interface IAppRepository
  extends IK8sObject<
      {
        clusterName: string;
        creationTimestamp: string;
        deletionGracePeriodSeconds: string | null;
        deletionTimestamp: string | null;
        resourceVersion: string;
        selfLink: string;
      },
      {
        type: string;
        url: string;
        auth: {
          header: {
            secretKeyRef: {
              name: string;
              key: string;
            };
          };
        };
      },
      undefined
    > {}

export interface IAppRepositoryList
  extends IK8sList<
      IAppRepository,
      {
        continue: string;
        resourceVersion: string;
        selfLink: string;
      }
    > {}

export interface IFunctionList extends IK8sList<IFunction, {}> {}

/** @see https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#response-status-kind */
export interface IStatus extends IK8sResource {
  kind: "Status";
  status: "Success" | "Failure";
  message: string;
  reason:
    | "BadRequest"
    | "Unauthorized"
    | "Forbidden"
    | "NotFound"
    | "AlreadyExists"
    | "Conflict"
    | "Invalid"
    | "Timeout"
    | "ServerTimeout"
    | "MethodNotAllowed"
    | "InternalError";
  details?: {
    kind?: string;
    name?: string;
    causes?: IStatusCause[] | string;
  };
}

interface IStatusCause {
  field: string;
  message: string;
  reason: string;
}

export interface IRouterPathname {
  router: {
    location: {
      pathname: string;
    };
  };
}

export interface IKubelessConfigMap {
  metadata: {
    name: string;
  };
  data: {
    "runtime-images": string;
  };
}

export interface IRuntimeVersion {
  name: string;
  version: string;
  runtimeImage: string;
  initImage: string;
}

export interface IRuntime {
  ID: string;
  versions: IRuntimeVersion[];
  depName: string;
  fileNameSuffix: string;
}

export interface IRBACRole {
  apiGroup: string;
  namespace?: string;
  clusterWide?: boolean;
  resource: string;
  verbs: string[];
}

export interface IAppOverview {
  releaseName: string;
  namespace: string;
  version: string;
  icon?: string;
}
