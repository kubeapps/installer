import { Kube } from "./Kube";
import ResourceRef from "./ResourceRef";
import { IResource } from "./types";

describe("ResourceRef", () => {
  describe("constructor", () => {
    it("it returns a ResourceRef with the correct details", () => {
      const r = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "foo",
          namespace: "bar",
        },
      } as IResource;

      const ref = new ResourceRef(r);
      expect(ref).toBeInstanceOf(ResourceRef);
      expect(ref).toEqual({
        apiVersion: r.apiVersion,
        kind: r.kind,
        name: r.metadata.name,
        namespace: r.metadata.namespace,
      });
    });

    it("sets a default namespace if not in the resource", () => {
      const r = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "foo",
        },
      } as IResource;

      const ref = new ResourceRef(r);
      expect(ref.namespace).toBe("default");
    });

    it("allows the default namespace to be provided", () => {
      const r = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "foo",
        },
      } as IResource;

      const ref = new ResourceRef(r, "bar");
      expect(ref.namespace).toBe("bar");
    });
  });

  describe("getResourceURL", () => {
    let kubeGetResourceURLMock: jest.Mock;
    beforeEach(() => {
      kubeGetResourceURLMock = Kube.getResourceURL = jest.fn();
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it("calls Kube.getResourceURL with the correct arguments", () => {
      const r = {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "foo",
          namespace: "bar",
        },
      } as IResource;

      const ref = new ResourceRef(r);

      ref.getResourceURL();
      expect(kubeGetResourceURLMock).toBeCalledWith("v1", "services", "bar", "foo");
    });
  });
});
