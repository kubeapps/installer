import * as React from "react";
import { Link } from "react-router-dom";

import { IChart, IChartState } from "../../shared/types";
import { escapeRegExp } from "../../shared/utils";
import { CardGrid } from "../Card";
import { NotFoundErrorAlert } from "../ErrorAlert";
import PageHeader from "../PageHeader";
import SearchFilter from "../SearchFilter";
import ChartListItem from "./ChartListItem";

interface IChartListProps {
  charts: IChartState;
  repo: string;
  filter: string;
  fetchCharts: (repo: string) => Promise<{}>;
  pushSearchFilter: (filter: string) => any;
}

interface IChartListState {
  filter: string;
}

class ChartList extends React.Component<IChartListProps, IChartListState> {
  public state: IChartListState = {
    filter: "",
  };

  public componentDidMount() {
    const { repo, fetchCharts, filter } = this.props;
    this.setState({ filter });
    fetchCharts(repo);
  }

  public componentWillReceiveProps(nextProps: IChartListProps) {
    if (nextProps.filter !== this.state.filter) {
      this.setState({ filter: nextProps.filter });
    }
  }

  public render() {
    const { charts: { isFetching }, pushSearchFilter } = this.props;
    const items = this.filteredCharts(this.props.charts.items, this.state.filter);
    if (!isFetching && !items) {
      return (
        <NotFoundErrorAlert
          resource={"Charts"}
          children={
            <div>
              Manage your Helm chart repositories in Kubeapps by visiting the{" "}
              <Link to={`/config/repos`}>App repositories configuration</Link> page.
            </div>
          }
        />
      );
    }
    const chartItems = items.map(c => <ChartListItem key={c.id} chart={c} />);
    return (
      <section className="ChartList">
        <PageHeader>
          <h1>Charts</h1>
          <SearchFilter
            className="margin-l-big"
            placeholder="search charts..."
            onChange={this.handleFilterQueryChange}
            value={this.state.filter}
            onSubmit={pushSearchFilter}
          />
        </PageHeader>
        {isFetching ? <div>Loading...</div> : <CardGrid>{chartItems}</CardGrid>}
      </section>
    );
  }

  private filteredCharts(charts: IChart[], filter: string) {
    return charts.filter(c => new RegExp(escapeRegExp(filter), "i").test(c.id));
  }

  private handleFilterQueryChange = (filter: string) => {
    this.setState({
      filter,
    });
  };
}

export default ChartList;
