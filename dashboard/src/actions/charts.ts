import { JSONSchema4 } from "json-schema";
import { ThunkAction } from "redux-thunk";
import { ActionType, createAction } from "typesafe-actions";

import Chart from "../shared/Chart";
import {
  FetchError,
  IChart,
  IChartCategory,
  IChartVersion,
  IStoreState,
  NotFoundError,
} from "../shared/types";

export const reachEnd = createAction("REACH_END");

export const idleStatus = "IDLE";
export const errorStatus = "ERROR";
export const loadingStatus = "LOADING";
export const finishedStatus = "FINISHED";

export const requestCharts = createAction("REQUEST_CHARTS", resolve => {
  return (page: number) => resolve(page);
});

export const requestChartsSearch = createAction("REQUEST_CHARTS_SEARCH", resolve => {
  return (query: string) => resolve(query);
});

export const requestChartsCategories = createAction("REQUEST_CHARTS_CATEGORIES");

export const requestChart = createAction("REQUEST_CHART");

export const receiveCharts = createAction("RECEIVE_CHARTS", resolve => {
  return (charts: IChart[]) => resolve(charts);
});

export const receiveChartsSearch = createAction("RECEIVE_CHARTS_SEARCH", resolve => {
  return (charts: IChart[], query: string) => resolve(charts, query);
});

export const receiveChartCategories = createAction("RECEIVE_CHART_CATEGORIES", resolve => {
  return (categories: IChartCategory[]) => resolve(categories);
});

export const requestChartsVersions = createAction("REQUEST_CHART_VERSIONS");

export const receiveChartVersions = createAction("RECEIVE_CHART_VERSIONS", resolve => {
  return (versions: IChartVersion[]) => resolve(versions);
});

export const errorChart = createAction("ERROR_CHART", resolve => {
  return (err: Error) => resolve(err);
});

export const selectChartVersion = createAction("SELECT_CHART_VERSION", resolve => {
  return (chartVersion: IChartVersion, values?: string, schema?: JSONSchema4) =>
    resolve({ chartVersion, values, schema });
});

export const requestDeployedChartVersion = createAction("REQUEST_DEPLOYED_CHART_VERSION");

export const receiveDeployedChartVersion = createAction(
  "RECEIVE_DEPLOYED_CHART_VERSION",
  resolve => {
    return (chartVersion: IChartVersion, values?: string, schema?: JSONSchema4) =>
      resolve({ chartVersion, values, schema });
  },
);

export const resetChartVersion = createAction("RESET_CHART_VERSION");

export const resetChartsSearch = createAction("RESET_CHARTS_SEARCH");

export const resetPaginaton = createAction("RESET_CHARTS_PAGINATION");

export const selectReadme = createAction("SELECT_README", resolve => {
  return (readme: string) => resolve(readme);
});

export const errorReadme = createAction("ERROR_README", resolve => {
  return (message: string) => resolve(message);
});

const allActions = [
  errorChart,
  errorReadme,
  reachEnd,
  receiveChartCategories,
  receiveChartVersions,
  receiveCharts,
  receiveChartsSearch,
  receiveDeployedChartVersion,
  requestChart,
  requestCharts,
  requestChartsCategories,
  requestChartsSearch,
  requestChartsVersions,
  requestDeployedChartVersion,
  resetChartVersion,
  resetChartsSearch,
  resetPaginaton,
  selectChartVersion,
  selectReadme,
];

export type ChartsAction = ActionType<typeof allActions[number]>;

export function fetchChartsWithPagination(
  cluster: string,
  namespace: string,
  repos: string,
  query: string,
  page: number,
  size: number,
  nextPage: number,
): ThunkAction<Promise<IChart[]>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    try {
      if (page === nextPage && !(query === "" && size === 0)) {
        dispatch(requestCharts(page)); // set the current processing page
        if (query.length > 0) {
          requestChartsSearch(query);
        }
        const charts = await Chart.fetchChartsWithPagination(
          cluster,
          namespace,
          repos,
          query,
          page,
          size,
        );
        if (charts && charts.length > 0) {
          if (query.length > 0) {
            dispatch(receiveChartsSearch(charts, query));
          } else {
            dispatch(receiveCharts(charts));
          }
        } else {
          dispatch(reachEnd());
        }
        return charts;
      } else {
        return [];
      }
    } catch (e) {
      dispatch(errorChart(new FetchError(e.message)));
      return [];
    }
  };
}

export function fetchChartCategories(
  cluster: string,
  namespace: string,
  repos: string,
): ThunkAction<Promise<IChartCategory[]>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    dispatch(requestChartsCategories());
    try {
      const categories = await Chart.fetchChartCategories(cluster, namespace, repos);
      if (categories) {
        dispatch(receiveChartCategories(categories));
      }
      return categories;
    } catch (e) {
      dispatch(errorChart(new FetchError(e.message)));
      return [];
    }
  };
}

export function fetchChartVersions(
  cluster: string,
  namespace: string,
  id: string,
): ThunkAction<Promise<IChartVersion[]>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    dispatch(requestChartsVersions());
    try {
      const versions = await Chart.fetchChartVersions(cluster, namespace, id);
      if (versions) {
        dispatch(receiveChartVersions(versions));
      }
      return versions;
    } catch (e) {
      dispatch(errorChart(new FetchError(e.message)));
      return [];
    }
  };
}

async function getChart(cluster: string, namespace: string, id: string, version: string) {
  let values = "";
  let schema = {};
  const chartVersion = await Chart.getChartVersion(cluster, namespace, id, version);
  if (chartVersion) {
    try {
      values = await Chart.getValues(cluster, namespace, id, version);
      schema = await Chart.getSchema(cluster, namespace, id, version);
    } catch (e) {
      if (e.constructor !== NotFoundError) {
        throw e;
      }
    }
  }
  return { chartVersion, values, schema };
}

export function getChartVersion(
  cluster: string,
  namespace: string,
  id: string,
  version: string,
): ThunkAction<Promise<void>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    try {
      dispatch(requestChart());
      const { chartVersion, values, schema } = await getChart(cluster, namespace, id, version);
      if (chartVersion) {
        dispatch(selectChartVersion(chartVersion, values, schema));
      }
    } catch (e) {
      dispatch(errorChart(new FetchError(e.message)));
    }
  };
}

export function getDeployedChartVersion(
  cluster: string,
  namespace: string,
  id: string,
  version: string,
): ThunkAction<Promise<void>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    try {
      dispatch(requestDeployedChartVersion());
      const { chartVersion, values, schema } = await getChart(cluster, namespace, id, version);
      if (chartVersion) {
        dispatch(receiveDeployedChartVersion(chartVersion, values, schema));
      }
    } catch (e) {
      dispatch(errorChart(new FetchError(e.message)));
    }
  };
}

export function fetchChartVersionsAndSelectVersion(
  cluster: string,
  namespace: string,
  id: string,
  version?: string,
): ThunkAction<Promise<void>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    const versions = (await dispatch(
      fetchChartVersions(cluster, namespace, id),
    )) as IChartVersion[];
    if (versions.length > 0) {
      let cv: IChartVersion = versions[0];
      if (version) {
        const found = versions.find(v => v.attributes.version === version);
        if (!found) {
          throw new Error("could not find chart version");
        }
        cv = found;
      }
      dispatch(selectChartVersion(cv));
    }
  };
}

export function getChartReadme(
  cluster: string,
  namespace: string,
  id: string,
  version: string,
): ThunkAction<Promise<void>, IStoreState, null, ChartsAction> {
  return async dispatch => {
    try {
      const readme = await Chart.getReadme(cluster, namespace, id, version);
      dispatch(selectReadme(readme));
    } catch (e) {
      dispatch(errorReadme(e.toString()));
    }
  };
}
