import { axiosWithAuth } from "./AxiosInstance";
import { APIBase } from "./Kube";
import * as url from "./url";

import { ForbiddenError, IResource, NotFoundError } from "./types";

export default class Namespace {
  public static async list() {
    const { data } = await axiosWithAuth.get<{ namespaces: IResource[] }>(
      url.backend.namespaces.list(),
    );
    return data;
  }

  public static async create(name: string) {
    const { data } = await axiosWithAuth.post<IResource>(`${APIBase}/api/v1/namespaces/`, {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name,
      },
    });
    return data;
  }

  public static async get(name: string) {
    try {
      const { data } = await axiosWithAuth.get<IResource>(`${APIBase}/api/v1/namespaces/${name}`);
      return data;
    } catch (err) {
      switch (err.constructor) {
        case ForbiddenError:
          throw new ForbiddenError(
            `You don't have sufficient permissions to use the namespace ${name}`,
          );
        case NotFoundError:
          throw new NotFoundError(`Namespace ${name} not found. Create it before using it.`);
        default:
          throw err;
      }
    }
  }
}

// Set of namespaces used accross the applications as default and "all ns" placeholders
export const definedNamespaces = {
  all: "_all",
};
