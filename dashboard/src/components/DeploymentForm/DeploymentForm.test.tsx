import { shallow } from "enzyme";
import * as React from "react";
import itBehavesLike from "../../shared/specs";
import { IChartState, IChartVersion, NotFoundError } from "../../shared/types";
import ErrorSelector from "../ErrorAlert/ErrorSelector";
import DeploymentForm from "./DeploymentForm";

const defaultProps = {
  kubeappsNamespace: "kubeapps",
  bindingsWithSecrets: [],
  chartID: "foo",
  chartVersion: "1.0.0",
  error: undefined,
  selected: {} as IChartState["selected"],
  deployChart: jest.fn(),
  push: jest.fn(),
  fetchChartVersions: jest.fn(),
  getBindings: jest.fn(),
  getChartVersion: jest.fn(),
  getChartValues: jest.fn(),
  namespace: "default",
};

itBehavesLike("aLoadingComponent", { component: DeploymentForm, props: defaultProps });

describe("renders an error", () => {
  it("renders an error if it cannot find the given chart", () => {
    const wrapper = shallow(
      <DeploymentForm
        {...defaultProps}
        selected={{ error: new NotFoundError() } as IChartState["selected"]}
      />,
    );
    expect(wrapper.find(ErrorSelector).exists()).toBe(true);
    expect(wrapper.find(ErrorSelector).html()).toContain("Chart &quot;foo&quot; (1.0.0) not found");
  });

  it("renders a generic error", () => {
    const wrapper = shallow(
      <DeploymentForm
        {...defaultProps}
        selected={{ error: new Error() } as IChartState["selected"]}
      />,
    );
    expect(wrapper.find(ErrorSelector).exists()).toBe(true);
    expect(wrapper.find(ErrorSelector).html()).toContain("Sorry! Something went wrong");
  });
});

it("renders the full DeploymentForm", () => {
  const versions = [{ id: "foo", attributes: { version: "1.2.3" } }] as IChartVersion[];
  const wrapper = shallow(
    <DeploymentForm {...defaultProps} selected={{ versions, version: versions[0] }} />,
  );
  expect(wrapper).toMatchSnapshot();
});
