import configureMockStore from "redux-mock-store";
import thunk from "redux-thunk";
import { getType } from "typesafe-actions";

import actions from ".";
import { App } from "../shared/App";
import { IAppState } from "../shared/types";

const mockStore = configureMockStore([thunk]);

let store: any;

beforeEach(() => {
  const state: IAppState = {
    isFetching: false,
    items: [],
    listingAll: false,
  };
  store = mockStore({
    apps: {
      state,
    },
  });
});

describe("fetches applications", () => {
  const listAppsOrig = App.listApps;
  let listAppsMock: jest.Mock;
  beforeEach(() => {
    listAppsMock = jest.fn(() => []);
    App.listApps = listAppsMock;
  });
  afterEach(() => {
    App.listApps = listAppsOrig;
  });
  it("fetches all applications", async () => {
    const expectedActions = [
      { type: getType(actions.apps.listApps) },
      { type: getType(actions.apps.receiveAppList), apps: [], listingAll: true },
    ];
    await store.dispatch(actions.apps.fetchApps("default", true));
    expect(store.getActions()).toEqual(expectedActions);
    expect(listAppsMock.mock.calls[0]).toEqual(["default", true]);
  });
  it("fetches default applications", () => {
    const expectedActions = [
      { type: getType(actions.apps.listApps) },
      { type: getType(actions.apps.receiveAppList), apps: [], listingAll: false },
    ];
    return store.dispatch(actions.apps.fetchApps("default", false)).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      expect(listAppsMock.mock.calls[0]).toEqual(["default", false]);
    });
  });
});

describe("delete applications", () => {
  const deleteApp = App.delete;
  let deleteAppMock: jest.Mock;
  beforeEach(() => {
    App.delete = jest.fn(() => []);
    deleteAppMock = App.delete as jest.Mock;
  });
  afterEach(() => {
    App.delete = deleteApp;
  });
  it("delete an application", async () => {
    await store.dispatch(actions.apps.deleteApp("foo", "default", false));
    expect(store.getActions()).toEqual([]);
    expect(deleteAppMock.mock.calls[0]).toEqual(["foo", "default", false]);
  });
  it("delete and purge an application", async () => {
    await store.dispatch(actions.apps.deleteApp("foo", "default", true));
    expect(store.getActions()).toEqual([]);
    expect(deleteAppMock.mock.calls[0]).toEqual(["foo", "default", true]);
  });
  it("delete and throw an error", async () => {
    const error = new Error("something went wrong!");
    const expectedActions = [{ type: getType(actions.apps.errorDeleteApp), err: error }];
    deleteAppMock.mockImplementation(() => {
      throw error;
    });
    expect(await store.dispatch(actions.apps.deleteApp("foo", "default", true))).toBe(false);
    expect(store.getActions()).toEqual(expectedActions);
  });
});
