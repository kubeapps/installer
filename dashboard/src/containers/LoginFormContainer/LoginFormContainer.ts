import { connect } from "react-redux";
import { Dispatch } from "redux";

import actions from "../../actions";
import LoginForm from "../../components/LoginForm";
import { IStoreState } from "../../shared/types";

function mapStateToProps({
  auth: { authenticated, authenticating, authenticationError },
}: IStoreState) {
  return {
    authenticated,
    authenticating,
    authenticationError,
  };
}

function mapDispatchToProps(dispatch: Dispatch<IStoreState>) {
  return {
    authenticate: (token: string) => dispatch(actions.auth.authenticate(token)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(LoginForm);
