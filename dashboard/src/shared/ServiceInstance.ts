import { axiosWithAuth } from "./AxiosInstance";
import { APIBase } from "./Kube";
import { ICondition, ServiceCatalog } from "./ServiceCatalog";
import { IStatus } from "./types";

export interface IServiceInstance {
  metadata: {
    name: string;
    namespace: string;
    selfLink: string;
    uid: string;
    resourceVersion: string;
    creationTimestamp: string;
    finalizers: string[];
    generation: number;
  };
  spec: {
    clusterServiceClassExternalName: string;
    clusterServicePlanExternalName: string;
    externalID: string;
    clusterServicePlanRef?: {
      name: string;
    };
    clusterServiceClassRef?: {
      name: string;
    };
  };
  status: { conditions: ICondition[] };
}

export class ServiceInstance {
  public static async create(
    cluster: string,
    releaseName: string,
    namespace: string,
    className: string,
    planName: string,
    parameters: {},
  ) {
    const { data } = await axiosWithAuth.post<IStatus>(this.getLink(cluster, namespace), {
      apiVersion: "servicecatalog.k8s.io/v1beta1",
      kind: "ServiceInstance",
      metadata: {
        name: releaseName,
      },
      spec: {
        clusterServiceClassExternalName: className,
        clusterServicePlanExternalName: planName,
        parameters,
      },
    });
    return data;
  }

  public static async get(
    cluster: string,
    namespace?: string,
    name?: string,
  ): Promise<IServiceInstance> {
    const url = this.getLink(cluster, namespace, name);
    const { data } = await axiosWithAuth.get<IServiceInstance>(url);
    return data;
  }

  public static async list(cluster: string, namespace?: string): Promise<IServiceInstance[]> {
    const instances = await ServiceCatalog.getItems<IServiceInstance>(
      cluster,
      "serviceinstances",
      namespace,
    );
    return instances;
  }

  private static getLink(cluster: string, namespace?: string, name?: string): string {
    return `${APIBase(cluster)}/apis/servicecatalog.k8s.io/v1beta1${
      namespace ? `/namespaces/${namespace}` : ""
    }/serviceinstances${name ? `/${name}` : ""}`;
  }
}
