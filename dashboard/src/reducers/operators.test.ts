import { getType } from "typesafe-actions";
import actions from "../actions";

import { IClusterServiceVersion, IPackageManifest, IResource } from "shared/types";
import operatorReducer from "./operators";
import { IOperatorsState } from "./operators";

describe("catalogReducer", () => {
  let initialState: IOperatorsState;

  beforeEach(() => {
    initialState = {
      isFetching: false,
      isOLMInstalled: false,
      operators: [],
      csvs: [],
      errors: {},
      resources: [],
    };
  });

  describe("operators", () => {
    const actionTypes = {
      checkingOLM: getType(actions.operators.checkingOLM),
      OLMInstalled: getType(actions.operators.OLMInstalled),
      requestOperators: getType(actions.operators.requestOperators),
      receiveOperators: getType(actions.operators.receiveOperators),
      errorOperators: getType(actions.operators.errorOperators),
      setNamespace: getType(actions.namespace.setNamespace),
      requestOperator: getType(actions.operators.requestOperator),
      receiveOperator: getType(actions.operators.receiveOperator),
      requestCSVs: getType(actions.operators.requestCSVs),
      receiveCSVs: getType(actions.operators.receiveCSVs),
      requestCSV: getType(actions.operators.requestCSV),
      receiveCSV: getType(actions.operators.receiveCSV),
      errorCSVs: getType(actions.operators.errorCSVs),
      creatingResource: getType(actions.operators.creatingResource),
      resourceCreated: getType(actions.operators.resourceCreated),
      deletingResource: getType(actions.operators.deletingResource),
      resourceDeleted: getType(actions.operators.resourceDeleted),
      errorResourceCreate: getType(actions.operators.errorResourceCreate),
      requestCustomResources: getType(actions.operators.requestCustomResources),
      receiveCustomResources: getType(actions.operators.receiveCustomResources),
      errorCustomResource: getType(actions.operators.errorCustomResource),
      requestCustomResource: getType(actions.operators.requestCustomResource),
      receiveCustomResource: getType(actions.operators.receiveCustomResource),
    };

    describe("reducer actions", () => {
      it("sets isFetching when checking if the OLM is installed", () => {
        expect(
          operatorReducer(undefined, {
            type: actionTypes.checkingOLM as any,
          }),
        ).toEqual({ ...initialState, isFetching: true });
      });

      it("unsets isFetching and mark OLM as installed", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.checkingOLM as any,
        });
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.OLMInstalled as any,
          }),
        ).toEqual({ ...initialState, isOLMInstalled: true });
      });

      it("sets receive operators", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.requestOperators as any,
        });
        const op = {} as IPackageManifest;
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.receiveOperators as any,
            payload: [op],
          }),
        ).toEqual({ ...initialState, isFetching: false, operators: [op] });
      });

      it("sets an error", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.requestOperators as any,
        });
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.errorOperators as any,
            payload: new Error("Boom!"),
          }),
        ).toEqual({ ...initialState, isFetching: false, errors: { fetch: new Error("Boom!") } });
      });

      it("unsets an error when changing namespace", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.errorOperators as any,
          payload: new Error("Boom!"),
        });
        expect(state).toEqual({
          ...initialState,
          isFetching: false,
          errors: { fetch: new Error("Boom!") },
        });

        expect(
          operatorReducer(undefined, {
            type: actionTypes.setNamespace as any,
          }),
        ).toEqual({ ...initialState, error: undefined });
      });

      it("sets the initial state when changing namespace", () => {
        expect(
          operatorReducer(
            {
              ...initialState,
              isFetching: true,
              errors: { fetch: new Error("Boom!") },
              operators: [{} as any],
            },
            {
              type: actionTypes.setNamespace as any,
            },
          ),
        ).toEqual({ ...initialState });
      });

      it("sets receive operator", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.requestOperator as any,
        });
        const op = {} as IPackageManifest;
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.receiveOperator as any,
            payload: op,
          }),
        ).toEqual({ ...initialState, isFetching: false, operator: op });
      });

      it("sets receive csvs", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.requestCSVs as any,
        });
        const csv = {} as IClusterServiceVersion;
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.receiveCSVs as any,
            payload: [csv],
          }),
        ).toEqual({ ...initialState, isFetching: false, csvs: [csv] });
      });

      it("sets an error for csvs", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.requestCSVs as any,
        });
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.errorCSVs as any,
            payload: new Error("Boom!"),
          }),
        ).toEqual({ ...initialState, isFetching: false, errors: { fetch: new Error("Boom!") } });
      });

      it("sets receive csv", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.requestCSV as any,
        });
        const csv = {} as IClusterServiceVersion;
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.receiveCSV as any,
            payload: csv,
          }),
        ).toEqual({ ...initialState, isFetching: false, csv });
      });
    });

    it("creates a resource", () => {
      const state = operatorReducer(undefined, {
        type: actionTypes.creatingResource as any,
      });
      const resource = {} as IResource;
      expect(state).toEqual({ ...initialState, isFetching: true });
      expect(
        operatorReducer(undefined, {
          type: actionTypes.resourceCreated as any,
          payload: resource,
        }),
      ).toEqual({ ...initialState, isFetching: false });
    });

    it("sets an error creating a resource", () => {
      const state = operatorReducer(undefined, {
        type: actionTypes.creatingResource as any,
      });
      expect(state).toEqual({ ...initialState, isFetching: true });
      expect(
        operatorReducer(undefined, {
          type: actionTypes.errorResourceCreate as any,
          payload: new Error("Boom!"),
        }),
      ).toEqual({ ...initialState, isFetching: false, errors: { create: new Error("Boom!") } });
    });

    it("sets receive resources", () => {
      const state = operatorReducer(undefined, {
        type: actionTypes.requestCustomResources as any,
      });
      const resource = {} as IResource;
      expect(state).toEqual({ ...initialState, isFetching: true });
      expect(
        operatorReducer(undefined, {
          type: actionTypes.receiveCustomResources as any,
          payload: [resource],
        }),
      ).toEqual({ ...initialState, isFetching: false, resources: [resource] });
    });

    it("sets an error for resources", () => {
      const state = operatorReducer(undefined, {
        type: actionTypes.requestCustomResources as any,
      });
      expect(state).toEqual({ ...initialState, isFetching: true });
      expect(
        operatorReducer(undefined, {
          type: actionTypes.errorCustomResource as any,
          payload: new Error("Boom!"),
        }),
      ).toEqual({ ...initialState, isFetching: false, errors: { fetch: new Error("Boom!") } });
    });

    it("sets receive resource", () => {
      const state = operatorReducer(undefined, {
        type: actionTypes.requestCustomResource as any,
      });
      const resource = {} as IResource;
      expect(state).toEqual({ ...initialState, isFetching: true });
      expect(
        operatorReducer(undefined, {
          type: actionTypes.receiveCustomResource as any,
          payload: resource,
        }),
      ).toEqual({ ...initialState, isFetching: false, resource });
    });

    it("sets deleting resource", () => {
      const state = operatorReducer(undefined, {
        type: actionTypes.deletingResource as any,
      });
      expect(state).toEqual({ ...initialState, isFetching: true });
      expect(
        operatorReducer(undefined, {
          type: actionTypes.resourceDeleted as any,
        }),
      ).toEqual({ ...initialState, isFetching: false });
    });
  });
});
