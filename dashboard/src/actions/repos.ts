import * as yaml from "js-yaml";
import { ThunkAction } from "redux-thunk";
import { ActionType, createAction } from "typesafe-actions";
import { AppRepository } from "../shared/AppRepository";
import Chart from "../shared/Chart";
import { errorChart } from "./charts";

import { IAppRepository, IStoreState, NotFoundError } from "../shared/types";

export const addRepo = createAction("ADD_REPO");
export const addedRepo = createAction("ADDED_REPO", resolve => {
  return (added: IAppRepository) => resolve(added);
});

export const requestRepos = createAction("REQUEST_REPOS", resolve => {
  return (namespace: string) => resolve(namespace);
});
export const receiveRepos = createAction("RECEIVE_REPOS", resolve => {
  return (repos: IAppRepository[]) => resolve(repos);
});

export const requestRepo = createAction("REQUEST_REPO");
export const receiveRepo = createAction("RECEIVE_REPO", resolve => {
  return (repo: IAppRepository) => resolve(repo);
});

// Clear repo is basically receiving an empty repo
export const clearRepo = createAction("RECEIVE_REPO", resolve => {
  return () => resolve({} as IAppRepository);
});

export const showForm = createAction("SHOW_FORM");
export const hideForm = createAction("HIDE_FORM");
export const resetForm = createAction("RESET_FORM");
export const submitForm = createAction("SUBMIT_FROM");

export const redirect = createAction("REDIRECT", resolve => {
  return (path: string) => resolve(path);
});

export const redirected = createAction("REDIRECTED");
export const errorRepos = createAction("ERROR_REPOS", resolve => {
  return (err: Error, op: "create" | "update" | "fetch" | "delete") => resolve({ err, op });
});

const allActions = [
  addRepo,
  addedRepo,
  clearRepo,
  errorRepos,
  requestRepos,
  receiveRepo,
  receiveRepos,
  resetForm,
  errorChart,
  requestRepo,
  submitForm,
  showForm,
  hideForm,
  redirect,
  redirected,
];
export type AppReposAction = ActionType<typeof allActions[number]>;

export const deleteRepo = (
  name: string,
): ThunkAction<Promise<boolean>, IStoreState, null, AppReposAction> => {
  return async (dispatch, getState) => {
    try {
      const {
        config: { namespace },
      } = getState();
      await AppRepository.delete(name, namespace);
      dispatch(fetchRepos());
      return true;
    } catch (e) {
      dispatch(errorRepos(e, "delete"));
      return false;
    }
  };
};

export const resyncRepo = (
  name: string,
): ThunkAction<Promise<void>, IStoreState, null, AppReposAction> => {
  return async (dispatch, getState) => {
    try {
      const {
        config: { namespace },
      } = getState();
      const repo = await AppRepository.get(name, namespace);
      repo.spec.resyncRequests = repo.spec.resyncRequests || 0;
      repo.spec.resyncRequests++;
      await AppRepository.update(name, namespace, repo);
      // TODO: Do something to show progress
    } catch (e) {
      dispatch(errorRepos(e, "update"));
    }
  };
};

export const resyncAllRepos = (
  repoNames: string[],
): ThunkAction<Promise<void>, IStoreState, null, AppReposAction> => {
  return async (dispatch, getState) => {
    repoNames.forEach(name => {
      dispatch(resyncRepo(name));
    });
  };
};

// fetchRepos fetches the AppRepositories in a specified namespace, defaulting to those
// in Kubeapps' own namespace for backwards compatibility.
export const fetchRepos = (
  namespace = "",
): ThunkAction<Promise<void>, IStoreState, null, AppReposAction> => {
  return async (dispatch, getState) => {
    try {
      // Default to the kubeapps' namespace for existing call-sites until we
      // need to explicitly get repos for a specific namespace as well as
      // the global app repos from kubeapps' namespace.
      if (namespace === "") {
        const { config } = getState();
        namespace = config.namespace;
      }
      dispatch(requestRepos(namespace));
      const repos = await AppRepository.list(namespace);
      dispatch(receiveRepos(repos.items));
    } catch (e) {
      dispatch(errorRepos(e, "fetch"));
    }
  };
};

export const installRepo = (
  name: string,
  repoURL: string,
  authHeader: string,
  customCA: string,
  syncJobPodTemplate: string,
): ThunkAction<Promise<boolean>, IStoreState, null, AppReposAction> => {
  return async (dispatch, getState) => {
    let syncJobPodTemplateObj = {};
    try {
      if (syncJobPodTemplate.length) {
        syncJobPodTemplateObj = yaml.safeLoad(syncJobPodTemplate);
      }
      dispatch(addRepo());
      const data = await AppRepository.create(
        name,
        repoURL,
        authHeader,
        customCA,
        syncJobPodTemplateObj,
      );
      dispatch(addedRepo(data.appRepository));

      return true;
    } catch (e) {
      dispatch(errorRepos(e, "create"));
      return false;
    }
  };
};

export function checkChart(
  repo: string,
  chartName: string,
): ThunkAction<Promise<boolean>, IStoreState, null, AppReposAction> {
  return async (dispatch, getState) => {
    const {
      config: { namespace },
    } = getState();
    dispatch(requestRepo());
    const appRepository = await AppRepository.get(repo, namespace);
    try {
      await Chart.fetchChartVersions(`${repo}/${chartName}`);
      dispatch(receiveRepo(appRepository));
      return true;
    } catch (e) {
      dispatch(
        errorChart(new NotFoundError(`Chart ${chartName} not found in the repository ${repo}.`)),
      );
      return false;
    }
  };
}
