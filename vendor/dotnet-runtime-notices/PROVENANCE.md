# .NET runtime notices

Unmodified license and third-party notices from dotnet/runtime tag `v10.0.12`:

- https://github.com/dotnet/runtime/blob/v10.0.12/LICENSE.TXT
- https://github.com/dotnet/runtime/blob/v10.0.12/THIRD-PARTY-NOTICES.TXT

The currently built browser runtime reports product version `10.0.12`.
The SDK is pinned to `10.0.401` in `global.json` and the deploy workflow; the
`wasm-tools` workload may supply a newer 10.0 servicing runtime.
The license packager compares the generated `dotnet.runtime.*.js` product
version with `runtime.json`: a newer 10.0 patch warns and the licenses output
links that exact release's notices; a new major/minor line fails the build.
Re-check these notices when changing the .NET runtime or SDK. These notices do
not change the licenses of the components they describe.
