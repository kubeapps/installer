import { getType } from "typesafe-actions";
import actions from "../actions";

import { IPackageManifest } from "shared/types";
import operatorReducer from "./operators";
import { IOperatorsState } from "./operators";

describe("catalogReducer", () => {
  let initialState: IOperatorsState;

  beforeEach(() => {
    initialState = {
      isFetching: false,
      isOLMInstalled: false,
      operators: [],
    };
  });

  describe("operators", () => {
    const actionTypes = {
      checkingOLM: getType(actions.operators.checkingOLM),
      OLMInstalled: getType(actions.operators.OLMInstalled),
      OLMNotInstalled: getType(actions.operators.OLMNotInstalled),
      requestOperators: getType(actions.operators.requestOperators),
      receiveOperators: getType(actions.operators.receiveOperators),
      errorOperators: getType(actions.operators.errorOperators),
      setNamespace: getType(actions.namespace.setNamespace),
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

      it("unsets isFetching and mark OLM as not installed", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.checkingOLM as any,
        });
        expect(state).toEqual({ ...initialState, isFetching: true });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.OLMNotInstalled as any,
          }),
        ).toEqual({ ...initialState, isOLMInstalled: false });
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
        ).toEqual({ ...initialState, isFetching: false, error: new Error("Boom!") });
      });

      it("unsets an error when changing namespace", () => {
        const state = operatorReducer(undefined, {
          type: actionTypes.errorOperators as any,
          payload: new Error("Boom!"),
        });
        expect(state).toEqual({ ...initialState, error: new Error("Boom!") });
        expect(
          operatorReducer(undefined, {
            type: actionTypes.setNamespace as any,
          }),
        ).toEqual({ ...initialState, error: undefined });
      });
    });
  });
});
