import { shallow } from "enzyme";
import context from "jest-plugin-context";
import * as React from "react";

import { Link } from "react-router-dom";
import { hapi } from "shared/hapi/release";
import { IRelease } from "shared/types";
import ChartInfo from "./ChartInfo";

const defaultProps = {
  app: {
    chart: {
      metadata: {
        appVersion: "0.0.1",
        description: "test chart",
        icon: "icon.png",
        version: "1.0.0",
      },
    },
    name: "foo",
  } as hapi.release.Release,
};

it("renders a app item", () => {
  const wrapper = shallow(<ChartInfo {...defaultProps} />);
  expect(wrapper.find(".ChartInfo").exists()).toBe(true);
  expect(wrapper).toMatchSnapshot();
});

context("when information about updates is available", () => {
  it("renders an up to date message if there are no updates", () => {
    const appWithoutUpdates = { ...defaultProps.app, updateInfo: { upToDate: true } } as IRelease;
    const wrapper = shallow(<ChartInfo {...defaultProps} app={appWithoutUpdates} />);
    expect(wrapper.html()).toContain("Up to date");
  });
  it("renders an new version found message if the chart latest version is newer", () => {
    const appWithUpdates = {
      ...defaultProps.app,
      updateInfo: { upToDate: false, appLatestVersion: "0.0.1", chartLatestVersion: "1.0.0" },
    } as IRelease;
    const wrapper = shallow(<ChartInfo {...defaultProps} app={appWithUpdates} />);
    expect(
      wrapper
        .find(Link)
        .children()
        .text(),
    ).toContain("Chart v1.0.0 available");
  });
  it("renders an new version found message if the chart latest version is newer", () => {
    const appWithUpdates = {
      ...defaultProps.app,
      updateInfo: { upToDate: false, appLatestVersion: "1.1.0", chartLatestVersion: "1.0.0" },
    } as IRelease;
    const wrapper = shallow(<ChartInfo {...defaultProps} app={appWithUpdates} />);
    expect(
      wrapper
        .find(Link)
        .children()
        .text(),
    ).toContain("New App version 1.1.0 available");
  });
  it("renders a warning if there are errors with the update info", () => {
    const appWithUpdates = {
      ...defaultProps.app,
      updateInfo: { error: new Error("Boom!"), upToDate: false, chartLatestVersion: "" },
    } as IRelease;
    const wrapper = shallow(<ChartInfo {...defaultProps} app={appWithUpdates} />);
    expect(wrapper.html()).toContain("Update check failed. Boom!");
  });
});
