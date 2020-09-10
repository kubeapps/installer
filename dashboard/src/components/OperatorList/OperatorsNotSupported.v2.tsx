import * as React from "react";
import { Link } from "react-router-dom";

import Alert from "components/js/Alert";
import * as url from "shared/url";

interface IOperatorNotSupportedProps {
  namespace: string;
  kubeappsCluster: string;
}

function OperatorNotSupported(props: IOperatorNotSupportedProps) {
  return (
    <Alert theme="warning">
      <h6 style={{ marginTop: 0 }}>
        Operators are supported on the cluster on which Kubeapps is installed only
      </h6>
      <span>
        Kubeapps' Operator support enables the addition of{" "}
        <Link to={url.app.operators.list(props.kubeappsCluster, props.namespace)}>
          operators on the cluster on which Kubeapps is installed only
        </Link>
        .
      </span>
    </Alert>
  );
}

export default OperatorNotSupported;
