import * as React from "react";
import { IServiceBinding } from "../../shared/ServiceBinding";

interface IRemoveBindingButtonProps {
  binding: IServiceBinding;
  removeBinding: (name: string, ns: string) => Promise<boolean>;
}

export class RemoveBindingButton extends React.Component<IRemoveBindingButtonProps> {
  public render() {
    return (
      <div className="RemoveBindingButton">
        <button
          className="button button-small button-danger"
          onClick={this.handleRemoveBindingClick}
        >
          Remove
        </button>
      </div>
    );
  }

  private handleRemoveBindingClick = async () => {
    const { removeBinding, binding } = this.props;
    const { name, namespace } = binding.metadata;
    removeBinding(name, namespace);
  };
}
