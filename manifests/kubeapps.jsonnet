local kube = import "kube.libsonnet";
local kubecfg = import "kubecfg.libsonnet";

local host = null;
local tls = false;
local kubeless = import "kubeless.jsonnet";
local ssecrets = import "sealed-secrets.jsonnet";

local labels = {
  metadata+: {
    labels+: {
      "created-by": "kubeapps"
    }
  }
};
// Some manifests are nested deeper than the root (e.g. dashboard.api.deploy)
// so we need to make sure we're only applying the labels to objects that have
// the manifest key
local labelify(src) = if std.objectHas(src, "metadata") then src + labels else src;
local labelifyEach(src) = {
  [k]: if std.isArray(src[k]) then
    std.map(labelify, src[k])
    else 
    labelify(src[k])
  for k in std.objectFields(src)
};

{
  namespace:: {metadata+: {namespace: "kubeapps"}},

  ns: kube.Namespace($.namespace.metadata.namespace) + labels,

  // This is the main gateway for Kubeapps and acts as a reverse-proxy to the
  // frontend and other services.
  nginx: labelifyEach((import "nginx.jsonnet")),

  // NB: these are left in their usual namespaces, to avoid forcing
  // non-default command line options onto client tools
  kubeless: labelifyEach(kubeless),
  ssecrets: [s + labels for s in ssecrets],

  dashboard_:: (import "kubeapps-dashboard.jsonnet") {
    namespace:: $.namespace,
    mongodb_svc:: $.mongodb_.svc,
    mongodb_secret:: $.mongodb_.secret,
    ingress:: null,
  },
  dashboard: labelifyEach($.dashboard_) {
    ui: labelifyEach($.dashboard_.ui),
    apprepository: labelifyEach($.dashboard_.apprepository) {
      apprepos: labelifyEach($.dashboard_.apprepository.apprepos),
    },
    chartsvc: labelifyEach($.dashboard_.chartsvc),
    tillerHelmCRD: labelifyEach($.dashboard_.tillerHelmCRD),
  },

  mongodb_:: (import "mongodb.jsonnet") {
    namespace:: $.namespace,
  },
  mongodb: labelifyEach($.mongodb_),
}
