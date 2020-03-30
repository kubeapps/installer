import { shallow } from "enzyme";
import * as React from "react";
import { IPackageManifest } from "shared/types";
import itBehavesLike from "../../shared/specs";
import { CardGrid } from "../Card";
import { ErrorSelector } from "../ErrorAlert";
import InfoCard from "../InfoCard";
import OLMNotFound from "./OLMNotFound";
import OperatorList, { IOperatorListProps } from "./OperatorList";

const defaultProps: IOperatorListProps = {
  isFetching: false,
  checkOLMInstalled: jest.fn(),
  isOLMInstalled: false,
  operators: [],
  namespace: "default",
  getOperators: jest.fn(),
  getCSVs: jest.fn(),
  csvs: [],
};

const sampleOperator = {
  metadata: {
    name: "foo",
  },
  status: {
    provider: {
      name: "kubeapps",
    },
    defaultChannel: "alpha",
    channels: [
      {
        name: "alpha",
        currentCSV: "kubeapps-operator",
        currentCSVDesc: {
          version: "1.0.0",
          annotations: {
            categories: "security",
          },
        },
      },
    ],
  },
} as IPackageManifest;

const sampleCSV = {
  metadata: { name: "kubeapps-operator" },
  spec: {
    icon: [{}],
    provider: {
      name: "kubeapps",
    },
    customresourcedefinitions: {
      owned: [
        {
          name: "foo.kubeapps.com",
          version: "v1alpha1",
          kind: "Foo",
          resources: [{ kind: "Deployment" }],
        },
      ],
    },
  },
} as any;

itBehavesLike("aLoadingComponent", {
  component: OperatorList,
  props: { ...defaultProps, isFetching: true },
});

it("call the OLM check and render the NotFound message if not found", () => {
  const checkOLMInstalled = jest.fn();
  const wrapper = shallow(<OperatorList {...defaultProps} checkOLMInstalled={checkOLMInstalled} />);
  expect(checkOLMInstalled).toHaveBeenCalled();
  expect(wrapper.find(OLMNotFound)).toExist();
});

it("re-request operators if the namespace changes", () => {
  const getOperators = jest.fn();
  const getCSVs = jest.fn();
  const wrapper = shallow(
    <OperatorList {...defaultProps} getOperators={getOperators} getCSVs={getCSVs} />,
  );
  wrapper.setProps({ namespace: "other" });
  expect(getOperators).toHaveBeenCalledTimes(2);
  expect(getCSVs).toHaveBeenCalledTimes(2);
});

it("renders an error if exists", () => {
  const wrapper = shallow(
    <OperatorList {...defaultProps} isOLMInstalled={true} error={new Error("Boom!")} />,
  );
  expect(wrapper.find(ErrorSelector)).toExist();
  expect(
    wrapper
      .find(ErrorSelector)
      .dive()
      .dive()
      .text(),
  ).toMatch("Boom!");
});

it("skips the error if the OLM is not installed", () => {
  const wrapper = shallow(
    <OperatorList
      {...defaultProps}
      isOLMInstalled={false}
      error={new Error("There are no operators!")}
    />,
  );
  expect(wrapper.find(ErrorSelector)).not.toExist();
  expect(wrapper.find(OLMNotFound)).toExist();
});

it("render the operator list with installed operators", () => {
  const wrapper = shallow(
    <OperatorList
      {...defaultProps}
      isOLMInstalled={true}
      operators={[sampleOperator]}
      csvs={[sampleCSV]}
    />,
  );
  expect(wrapper.find(OLMNotFound)).not.toExist();
  expect(wrapper.find(InfoCard)).toExist();
  // The section "Available operators" should be empty since all the ops are installed
  expect(wrapper.find("h3").filterWhere(c => c.text() === "Installed")).toExist();
  expect(
    wrapper
      .find(CardGrid)
      .last()
      .children(),
  ).not.toExist();
  expect(wrapper).toMatchSnapshot();
});

it("render the operator list with installed operators", () => {
  const wrapper = shallow(
    <OperatorList {...defaultProps} isOLMInstalled={true} operators={[sampleOperator]} csvs={[]} />,
  );
  expect(wrapper.find(OLMNotFound)).not.toExist();
  expect(wrapper.find(InfoCard)).toExist();
  // The section "Available operators" should not be empty since the operator is not installed
  expect(wrapper.find("h3").filterWhere(c => c.text() === "Installed")).not.toExist();
  expect(
    wrapper
      .find(CardGrid)
      .last()
      .children(),
  ).toExist();
  expect(wrapper).toMatchSnapshot();
});
