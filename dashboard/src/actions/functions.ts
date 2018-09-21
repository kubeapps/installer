import { Dispatch } from "redux";
import { ActionType, createActionDeprecated } from "typesafe-actions";

import Function from "../shared/Function";
import KubelessConfig from "../shared/KubelessConfig";
import { definedNamespaces } from "../shared/Namespace";
import { IFunction, IRuntime } from "../shared/types";

export const requestFunctions = createActionDeprecated("REQUEST_FUNCTIONS");
export const receiveFunctions = createActionDeprecated(
  "RECEIVE_FUNCTIONS",
  (functions: IFunction[]) => ({
    functions,
    type: "RECEIVE_FUNCTIONS",
  }),
);
export const errorFunctions = createActionDeprecated(
  "ERROR_FUNCTIONS",
  (err: Error, op: "create" | "update" | "fetch" | "delete") => ({
    err,
    op,
    type: "ERROR_FUNCTIONS",
  }),
);
export const selectFunction = createActionDeprecated("SELECT_FUNCTION", (f: IFunction) => ({
  f,
  type: "SELECT_FUNCTION",
}));
export const setPodName = createActionDeprecated("SET_FUNCTION_POD_NAME", (name: string) => ({
  name,
  type: "SET_FUNCTION_POD_NAME",
}));
export const requestRuntimes = createActionDeprecated("REQUEST_RUNTIMES");
export const receiveRuntimes = createActionDeprecated(
  "RECEIVE_RUNTIMES",
  (runtimes: IRuntime[]) => ({
    runtimes,
    type: "RECEIVE_RUNTIMES",
  }),
);
const allActions = [
  requestFunctions,
  receiveFunctions,
  requestRuntimes,
  receiveRuntimes,
  errorFunctions,
  selectFunction,
  setPodName,
];
export type FunctionsAction = ActionType<typeof allActions[number]>;

export function fetchFunctions(ns?: string) {
  return async (dispatch: Dispatch) => {
    if (ns && definedNamespaces.all) {
      ns = undefined;
    }
    dispatch(requestFunctions());
    try {
      const functionList = await Function.list(ns);
      dispatch(receiveFunctions(functionList.items));
    } catch (e) {
      dispatch(errorFunctions(e, "fetch"));
    }
  };
}

export function getFunction(name: string, namespace: string) {
  return async (dispatch: Dispatch) => {
    dispatch(requestFunctions());
    try {
      const f = await Function.get(name, namespace);
      dispatch(selectFunction(f));
    } catch (e) {
      dispatch(errorFunctions(e, "fetch"));
    }
  };
}

export function createFunction(name: string, namespace: string, spec: IFunction["spec"]) {
  return async (dispatch: Dispatch) => {
    try {
      await Function.create(name, namespace, spec);
      return true;
    } catch (e) {
      dispatch(errorFunctions(e, "create"));
      return false;
    }
  };
}

export function deleteFunction(name: string, namespace: string) {
  return async (dispatch: Dispatch) => {
    try {
      await Function.delete(name, namespace);
      return true;
    } catch (e) {
      dispatch(errorFunctions(e, "delete"));
      return false;
    }
  };
}

export function updateFunction(name: string, namespace: string, newFn: IFunction) {
  return async (dispatch: Dispatch) => {
    try {
      const f = await Function.update(name, namespace, newFn);
      dispatch(selectFunction(f));
    } catch (e) {
      dispatch(errorFunctions(e, "update"));
    }
  };
}

export function getPodName(fn: IFunction) {
  return async (dispatch: Dispatch) => {
    try {
      const name = await Function.getPodName(fn);
      if (name) {
        dispatch(setPodName(name));
      }
    } catch (e) {
      dispatch(errorFunctions(e, "fetch"));
    }
  };
}

export function fetchRuntimes() {
  return async (dispatch: Dispatch) => {
    dispatch(requestRuntimes());
    try {
      const runtimeList = await KubelessConfig.getRuntimes();
      dispatch(receiveRuntimes(runtimeList));
      return runtimeList;
    } catch (e) {
      dispatch(errorFunctions(e, "fetch"));
    }
  };
}
