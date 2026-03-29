import { App, TerraformOutput, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { ComputeNetwork } from "@cdktf/provider-google/lib/compute-network";
import { ComputeSubnetwork } from "@cdktf/provider-google/lib/compute-subnetwork";
import { ComputeFirewall } from "@cdktf/provider-google/lib/compute-firewall";
import { ComputeInstance } from "@cdktf/provider-google/lib/compute-instance";
import { ComputeAddress } from "@cdktf/provider-google/lib/compute-address";

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? "readfast-live-jan2026";
const REGION = process.env.GCP_REGION ?? "us-central1";
const ZONE = process.env.GCP_ZONE ?? "us-central1-a";
const ADMIN_CIDR = process.env.ADMIN_CIDR ?? "0.0.0.0/32";
const INSTANCE_COUNT = Number(process.env.INSTANCE_COUNT ?? "1");

class GceStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new GoogleProvider(this, "google", {
      project: PROJECT_ID,
      region: REGION, 
      zone: ZONE,
    });

    const network = new ComputeNetwork(this, "fastReadNetwork", {
      name: "fast-read-network",
      autoCreateSubnetworks: false,
    });

    const subnetwork = new ComputeSubnetwork(this, "fastReadSubnet", {
      name: "fast-read-subnet",
      ipCidrRange: "10.10.0.0/24",
      region: REGION,
      network: network.id,
    });

    // Restrictive firewall: allow SSH only from a single IP or CIDR.
    // Replace with your public IP/CIDR before deployment.
    const adminSourceRange = ADMIN_CIDR;

    new ComputeFirewall(this, "allowSsh", {
      name: "fast-read-allow-ssh",
      network: network.id,
      direction: "INGRESS",
      sourceRanges: [adminSourceRange],
      allow: [
        {
          protocol: "tcp",
          ports: ["22"],
        },
      ],
    });

    const instanceCount = INSTANCE_COUNT;
    const machineType = "e2-medium";
    const bootImage = "debian-cloud/debian-12";

    const publicIps: string[] = [];

    for (let i = 0; i < instanceCount; i += 1) {
      const address = new ComputeAddress(this, `fastReadIp-${i + 1}`, {
        name: `fast-read-ip-${i + 1}`,
        region: REGION,
      });

      publicIps.push(address.address);

      new ComputeInstance(this, `fastReadVm-${i + 1}`, {
        name: `fast-read-vm-${i + 1}`,
        machineType,
        zone: ZONE,
        bootDisk: {
          initializeParams: {
            image: bootImage,
            size: 20,
            type: "pd-balanced",
          },
        },
        networkInterface: [
          {
            network: network.id,
            subnetwork: subnetwork.id,
            accessConfig: [
              {
                natIp: address.address,
              },
            ],
          },
        ],
        tags: ["fast-read-ssh"],
        metadata: {
          "block-project-ssh-keys": "true",
        },
      });
    }

    new TerraformOutput(this, "publicIps", {
      value: publicIps,
    });
  }
}

const app = new App();
new GceStack(app, "fast-read-gce");
app.synth();