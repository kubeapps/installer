import { Dispatch } from "redux";
import { createAction, getReturnOfExpression } from "typesafe-actions";

import { IStoreState } from "../shared/types";

export const setAuthenticated = createAction("SET_AUTHENTICATED", (authenticated: boolean) => ({
  authenticated,
  type: "SET_AUTHENTICATED",
}));

const allActions = [setAuthenticated].map(getReturnOfExpression);
export type AuthAction = typeof allActions[number];

export function authenticate(token: string) {
  return async (dispatch: Dispatch<IStoreState>) => {
    localStorage.setItem("kubeapps_auth_token", token);
    return dispatch(setAuthenticated(true));
  };
}

export function logout() {
  return async (dispatch: Dispatch<IStoreState>) => {
    localStorage.removeItem("kubeapps_auth_token");
    return dispatch(setAuthenticated(false));
  };
}
