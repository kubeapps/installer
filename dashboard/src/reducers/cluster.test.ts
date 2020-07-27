import { LOCATION_CHANGE, RouterActionType } from "connected-react-router";
import context from "jest-plugin-context";
import { getType } from "typesafe-actions";

import { IConfig } from "shared/Config";
import actions from "../actions";
import { IResource } from "../shared/types";
import clusterReducer, { IClustersState, initialState } from "./cluster";

describe("clusterReducer", () => {
  const initialTestState: IClustersState = {
    currentCluster: "initial-cluster",
    clusters: {
      default: {
        currentNamespace: "default",
        namespaces: ["default"],
      },
      "initial-cluster": {
        currentNamespace: "initial-namespace",
        namespaces: ["default", "initial-namespace"],
      },
    },
  };
  context("when LOCATION CHANGE", () => {
    const location = {
      hash: "",
      search: "",
      state: "",
    };

    describe("changes the current stored namespace if it is in the URL", () => {
      const testCases = [
        {
          path: "/c/default/ns/cyberdyne/apps",
          currentNamespace: "cyberdyne",
          currentCluster: "default",
        },
        {
          path: "/cyberdyne/apps",
          currentNamespace: "initial-namespace",
          currentCluster: "initial-cluster",
        },
        {
          path: "/c/barcluster/ns/T-600/charts",
          currentNamespace: "T-600",
          currentCluster: "barcluster",
        },
      ];
      testCases.forEach(tc => {
        it(tc.path, () =>
          expect(
            clusterReducer(initialTestState, {
              type: LOCATION_CHANGE,
              payload: {
                location: { ...location, pathname: tc.path },
                action: "PUSH" as RouterActionType,
                isFirstRendering: true,
              },
            }),
          ).toEqual({
            ...initialTestState,
            currentCluster: tc.currentCluster,
            clusters: {
              ...initialTestState.clusters,
              [tc.currentCluster]: {
                ...initialTestState.clusters[tc.currentCluster],
                currentNamespace: tc.currentNamespace,
              },
            },
          } as IClustersState),
        );
      });
    });
  });

  context("when ERROR_NAMESPACE", () => {
    const err = new Error("Bang!");

    it("when listing leaves namespaces intact and but ignores the error", () => {
      expect(
        clusterReducer(initialTestState, {
          type: getType(actions.namespace.errorNamespaces),
          payload: { cluster: "initial-cluster", err, op: "list" },
        }),
      ).toEqual({
        ...initialTestState,
        clusters: {
          ...initialTestState.clusters,
          "initial-cluster": {
            ...initialTestState.clusters["initial-cluster"],
            error: undefined,
          },
        },
      } as IClustersState);
    });

    it("leaves namespaces intact and sets the error", () => {
      expect(
        clusterReducer(initialTestState, {
          type: getType(actions.namespace.errorNamespaces),
          payload: { cluster: "initial-cluster", err, op: "create" },
        }),
      ).toEqual({
        ...initialTestState,
        clusters: {
          ...initialTestState.clusters,
          "initial-cluster": {
            ...initialTestState.clusters["initial-cluster"],
            error: { action: "create", error: err },
          },
        },
      } as IClustersState);
    });
  });

  context("when CLEAR_CLUSTERS", () => {
    it("returns to the initial state", () => {
      expect(
        clusterReducer(initialTestState, {
          type: getType(actions.namespace.clearClusters),
        }),
      ).toEqual({
        ...initialTestState,
        clusters: {
          ...initialState.clusters,
        },
      } as IClustersState);
    });
  });

  context("when SET_AUTHENTICATED", () => {
    it("sets the current namespace to the users default", () => {
      expect(
        clusterReducer(initialTestState, {
          type: getType(actions.auth.setAuthenticated),
          payload: { authenticated: true, oidc: false, defaultNamespace: "foo-bar" },
        }),
      ).toEqual({
        ...initialTestState,
        clusters: {
          ...initialTestState.clusters,
          default: { ...initialTestState.clusters.default, currentNamespace: "foo-bar" },
        },
      } as IClustersState);
    });
  });

  context("when SET_NAMESPACE", () => {
    it("sets the current namespace and clears error", () => {
      expect(
        clusterReducer(
          {
            ...initialTestState,
            clusters: {
              ...initialTestState.clusters,
              "initial-cluster": {
                ...initialTestState.clusters["initial-cluster"],
                currentNamespace: "other",
                error: { action: "create", error: new Error("Bang!") },
              },
            },
          },
          {
            type: getType(actions.namespace.setNamespace),
            payload: "default",
          },
        ),
      ).toEqual({
        ...initialTestState,
        clusters: {
          ...initialTestState.clusters,
          "initial-cluster": {
            ...initialTestState.clusters["initial-cluster"],
            currentNamespace: "default",
            error: undefined,
          },
        },
      } as IClustersState);
    });
  });

  context("when RECEIVE_NAMESPACE", () => {
    it("adds the namespace to the list and clears error", () => {
      expect(
        clusterReducer(
          {
            ...initialTestState,
            clusters: {
              default: {
                currentNamespace: "",
                namespaces: ["default"],
              },
              other: {
                currentNamespace: "",
                namespaces: ["othernamespace"],
                error: { action: "create", error: new Error("boom") },
              },
            },
          } as IClustersState,
          {
            type: getType(actions.namespace.receiveNamespace),
            payload: {
              cluster: "other",
              namespace: { metadata: { name: "bar" } } as IResource,
            },
          },
        ),
      ).toEqual({
        ...initialTestState,
        clusters: {
          default: {
            currentNamespace: "",
            namespaces: ["default"],
          },
          other: {
            currentNamespace: "",
            namespaces: ["bar", "othernamespace"],
            error: undefined,
          },
        },
      } as IClustersState);
    });
  });

  context("when RECEIVE_NAMESPACES", () => {
    it("updates the namespace list and clears error", () => {
      expect(
        clusterReducer(
          {
            ...initialTestState,
            clusters: {
              default: {
                currentNamespace: "",
                namespaces: ["default"],
              },
              other: {
                currentNamespace: "",
                namespaces: ["othernamespace"],
                error: { action: "create", error: new Error("boom") },
              },
            },
          } as IClustersState,
          {
            type: getType(actions.namespace.receiveNamespaces),
            payload: {
              cluster: "other",
              namespaces: ["one", "two", "three"],
            },
          },
        ),
      ).toEqual({
        ...initialTestState,
        clusters: {
          default: {
            currentNamespace: "",
            namespaces: ["default"],
          },
          other: {
            currentNamespace: "",
            namespaces: ["one", "two", "three"],
            error: undefined,
          },
        },
      } as IClustersState);
    });
  });

  context("when RECEIVE_CONFIG", () => {
    const config = {
      namespace: "kubeapps",
      appVersion: "dev",
      authProxyEnabled: false,
      oauthLoginURI: "",
      oauthLogoutURI: "",
      featureFlags: {
        operators: false,
        additionalClusters: [
          {
            name: "additionalCluster1",
            apiServiceURL: "https://not-used-by-dashboard.example.com/",
          },
          {
            name: "additionalCluster2",
            apiServiceURL: "https://not-used-by-dashboard.example.com/",
          },
        ],
      },
    } as IConfig;
    it("adds the additional clusters to the clusters state", () => {
      expect(
        clusterReducer(initialTestState, {
          type: getType(actions.config.receiveConfig),
          payload: config,
        }),
      ).toEqual({
        ...initialTestState,
        clusters: {
          ...initialTestState.clusters,
          additionalCluster1: {
            currentNamespace: "default",
            namespaces: [],
          },
          additionalCluster2: {
            currentNamespace: "default",
            namespaces: [],
          },
        },
      } as IClustersState);
    });

    it("does not error if there is not feature flag", () => {
      const badConfig = {
        ...config,
      };
      // Manually delete additionalClusters so typescript doesn't complain
      // while still allowing us to test the case where it is not present.
      delete badConfig.featureFlags.additionalClusters;
      expect(
        clusterReducer(initialTestState, {
          type: getType(actions.config.receiveConfig),
          payload: badConfig,
        }),
      ).toEqual(initialTestState);
    });
  });
});
