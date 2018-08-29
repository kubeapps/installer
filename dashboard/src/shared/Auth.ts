import Axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { Store } from "redux";
import actions from "../actions";
import { store as appStore } from "../containers/Root";
import {
  AppConflict,
  ForbiddenError,
  IStoreState,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntity,
} from "./types";

const AuthTokenKey = "kubeapps_auth_token";

export class Auth {
  public static getAuthToken() {
    return localStorage.getItem(AuthTokenKey);
  }

  public static setAuthToken(token: string) {
    return localStorage.setItem(AuthTokenKey, token);
  }

  public static unsetAuthToken() {
    return localStorage.removeItem(AuthTokenKey);
  }

  public static wsProtocols() {
    const token = this.getAuthToken();
    if (!token) {
      return [];
    }
    return [
      "base64url.bearer.authorization.k8s.io." + btoa(token).replace(/=*$/g, ""),
      "binary.k8s.io",
    ];
  }

  public static fetchOptions(): RequestInit {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${this.getAuthToken()}`);
    return {
      headers,
    };
  }

  // Throws an error if the token is invalid
  public static async validateToken(token: string) {
    try {
      await Axios.get("/api/kube/", { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      const res = e.response as AxiosResponse;
      if (res.status === 401) {
        throw new Error("invalid token");
      }
    }
  }
}

// authenticatedAxiosInstance returns an axios instance with an interceptor
// configured to set the current auth token and handle errors.
export function createAxiosInstance(store: Store<IStoreState>) {
  const a = Axios.create();
  a.interceptors.request.use((config: AxiosRequestConfig) => {
    const authToken = Auth.getAuthToken();
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  });
  a.interceptors.response.use(
    response => response,
    e => {
      const err: AxiosError = e;
      let message = err.message;
      if (err.response && err.response.data.message) {
        message = err.response.data.message;
      }
      switch (err.response && err.response.status) {
        case 401:
          // Global action dispatch to log the user out
          if (err.response) {
            store.dispatch(actions.auth.authenticationError(message));
            store.dispatch(actions.auth.logout());
          }
          return Promise.reject(new UnauthorizedError(message));
        case 403:
          return Promise.reject(new ForbiddenError(message));
        case 404:
          return Promise.reject(new NotFoundError(message));
        case 409:
          return Promise.reject(new AppConflict(message));
        case 422:
          return Promise.reject(new UnprocessableEntity(message));
        default:
          return Promise.reject(e);
      }
    },
  );
  return a;
}

export const axios = createAxiosInstance(appStore);
