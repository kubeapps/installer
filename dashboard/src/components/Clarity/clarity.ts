// Code from: https://stackblitz.com/edit/react-ts-wrapper-5w8nhf
import { CdsButton as Button } from "@clr/core/button";
import { CdsIcon as Icon, ClarityIcons as ClrIcons } from "@clr/core/icon-shapes";

import "@clr/core/button";
import "@clr/core/icon";
import { createReactComponent } from "./converter/reactWrapper";

type CdsIconType = Icon;
export const CdsIcon = createReactComponent<CdsIconType>("cds-icon");
export const ClarityIcons = ClrIcons;

type CdsButtonType = Button & HTMLButtonElement;
export const CdsButton = createReactComponent<CdsButtonType>("cds-button");
