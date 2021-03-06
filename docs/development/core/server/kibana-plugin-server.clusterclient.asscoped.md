<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [kibana-plugin-server](./kibana-plugin-server.md) &gt; [ClusterClient](./kibana-plugin-server.clusterclient.md) &gt; [asScoped](./kibana-plugin-server.clusterclient.asscoped.md)

## ClusterClient.asScoped() method

Creates an instance of [IScopedClusterClient](./kibana-plugin-server.iscopedclusterclient.md) based on the configuration the current cluster client that exposes additional `callAsCurrentUser` method scoped to the provided req. Consumers shouldn't worry about closing scoped client instances, these will be automatically closed as soon as the original cluster client isn't needed anymore and closed.

<b>Signature:</b>

```typescript
asScoped(request?: KibanaRequest | LegacyRequest | FakeRequest): IScopedClusterClient;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  request | <code>KibanaRequest &#124; LegacyRequest &#124; FakeRequest</code> | Request the <code>IScopedClusterClient</code> instance will be scoped to. Supports request optionality, Legacy.Request &amp; FakeRequest for BWC with LegacyPlatform |

<b>Returns:</b>

`IScopedClusterClient`

