import { Kube } from "./Kube";
import { IResource } from "./types";

// ResourceRef defines a reference to a namespaced Kubernetes API Object and
// provides helpers to retrieve the resource URL
class ResourceRef {
  public apiVersion: string;
  public kind: string;
  public name: string;
  public namespace: string;

  // Creates a new ResourceRef instance from an existing IResource. Provide
  // defaultNamespace to set if the IResource doesn't specify a namespace.
  // TODO: add support for cluster-scoped resources, or add a ClusterResourceRef
  // class.
  constructor(r: IResource, defaultNamespace: string = "default") {
    this.apiVersion = r.apiVersion;
    this.kind = r.kind;
    this.name = r.metadata.name;
    this.namespace = r.metadata.namespace || defaultNamespace;
    return this;
  }

  // Gets a full resource URL for the referenced resource
  public getResourceURL() {
    return Kube.getResourceURL(this.apiVersion, this.resourcePath(), this.namespace, this.name);
  }

  // Gets the plural form of the resource Kind for use in the resource path
  private resourcePath() {
    // We explicitly define the plurals here, just in case a generic pluralizer
    // isn't sufficient. Note that CRDs can explicitly define pluralized forms,
    // which might not match with the Kind. If this becomes difficult to
    // maintain we can add a generic pluralizer and a way to override.
    switch (this.kind) {
      case "Service":
        return "services";
      default:
        throw new Error(`Don't know path for ${this.kind}, register it in ResourceRef`);
    }
  }
}

export default ResourceRef;
