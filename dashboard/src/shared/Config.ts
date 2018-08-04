import axios from "axios";

// IConfig is the configuration for Kubeapps
export interface IConfig {
  namespace: string;
}

export default class Config {
  public static async getConfig() {
    const url = Config.APIEndpoint;
    const { data } = await axios.get<IConfig>(url);
    return data;
  }

  private static APIEndpoint: string = "/config.json";
}
