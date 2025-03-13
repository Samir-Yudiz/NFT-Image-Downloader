const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const https = require("https");

// Configuration
const RPC_URL = "YOUR_ETHEREUM_RPC_URL"; // Replace with your provider (Infura, Alchemy, etc.)
const CONTRACT_ADDRESS = "YOUR_NFT_CONTRACT_ADDRESS"; // Replace with the target NFT contract
const OUTPUT_FOLDER = "./nft_images"; // Folder to save NFT images

// ERC-721 ABI
const ERC721_ABI = [
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function totalSupply() external view returns (uint256)",
];

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

// Function to fetch NFT metadata and download images
async function fetchAndDownloadNFTImages() {
  try {
    let totalSupply;

    // Fetch total supply if available
    try {
      totalSupply = await contract.totalSupply();
    } catch (error) {
      console.log("totalSupply() method not available. Using fallback.");
      totalSupply = 10000; // Adjust if the collection size is known
    }

    console.log(`Fetching metadata for ${totalSupply} NFTs...`);

    for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
      try {
        console.log(`Fetching metadata for Token ID: ${tokenId}`);
        let tokenURI = await contract.tokenURI(tokenId);

        // Resolve tokenURI (IPFS or other formats)
        tokenURI = resolveURI(tokenURI);

        // Fetch metadata
        const metadata = await fetchMetadata(tokenURI);
        if (!metadata) {
          console.log(`❌ No metadata found for Token ID ${tokenId}`);
          continue;
        }

        // Extract NFT name
        const nftName = metadata.name
          ? sanitizeFileName(metadata.name)
          : `NFT_${tokenId}`;

        // Extract and download the image
        if (metadata.image) {
          const imageUrl = resolveURI(metadata.image);
          const imageExt = path.extname(imageUrl) || ".jpg";
          await downloadImage(
            imageUrl,
            path.join(OUTPUT_FOLDER, `${nftName}${imageExt}`)
          );
          console.log(`✅ Downloaded image for ${nftName}`);
        } else {
          console.log(`❌ No image found for ${nftName}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching Token ID ${tokenId}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to resolve IPFS, Arweave, Filebase, PINTA, or HTTP URLs
function resolveURI(uri) {
  if (!uri) return null;

  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.split("ipfs://")[1]}`;
  }
  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.split("ar://")[1]}`;
  }
  if (uri.startsWith("filebase://")) {
    return `https://filebase.io/ipfs/${uri.split("filebase://")[1]}`;
  }
  if (uri.startsWith("pinta://")) {
    return `https://pinta.cloud/${uri.split("pinta://")[1]}`;
  }
  return uri; // Assume it's a direct HTTP/S URL
}

// Function to fetch metadata with browser-like headers
async function fetchMetadata(uri) {
  try {
    const response = await axios.get(uri, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        DNT: "1",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch metadata from ${uri}: ${error.message}`);
    return null;
  }
}

// Function to download an image
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (error) => {
        fs.unlink(filepath, () => {}); // Delete file if error
        reject(error);
      });
  });
}

// Function to sanitize file names (remove special characters)
function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]+/g, "").trim();
}

// Run the script
fetchAndDownloadNFTImages();
