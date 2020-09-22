import { CdsButton } from "@clr/react/button";
import { mount } from "enzyme";
import context from "jest-plugin-context";
import * as React from "react";
import itBehavesLike from "../../shared/specs";
import ConfirmDialog from "./ConfirmDialog";

const defaultProps = {
  loading: false,
  modalIsOpen: true,
  onConfirm: jest.fn(),
  closeModal: jest.fn(),
};

context("when loading is true", () => {
  itBehavesLike("aLoadingComponent", {
    component: ConfirmDialog,
    props: { ...defaultProps, loading: true },
  });
});

it("should modify the default confirmation text", () => {
  const wrapper = mount(
    <ConfirmDialog {...defaultProps} confirmationText="Sure?" confirmationButtonText="Sure!" />,
  );
  expect(wrapper.find(".confirmation-modal")).toIncludeText("Sure?");
  expect(wrapper.find(CdsButton).filterWhere(d => d.text() === "Sure!")).toExist();
});
