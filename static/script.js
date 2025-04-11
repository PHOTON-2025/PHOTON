document.addEventListener("DOMContentLoaded", () => {
  // Determine the current page based on the URL path:
  const isAllImagesPage =
    window.location.pathname === "/" ||
    window.location.pathname === "/all_images" ||
    window.location.pathname.includes("allimages.html");
  const isCategoriesPage =
    window.location.pathname === "/categories" ||
    window.location.pathname.includes("categories.html");
  // Alias for the All Images page (index page)
  const isIndexPage = isAllImagesPage;

  // Common variable for storing uploaded images (retrieved from localStorage)
  let uploadedImages = JSON.parse(localStorage.getItem("uploadedImages")) || [];

  // ------------------------------------------------------------------------
  // Function for the All Images (Index) page: Image upload, rendering, deletion
  // ------------------------------------------------------------------------
  const initAllImagesPage = () => {
    const dateInfo = document.getElementById("date-info");
    const imageGrid = document.getElementById("image-grid");
    const imageUploadInput = document.getElementById("image-upload");
    const addImageBtn = document.querySelector(".add-image-btn");

    if (!dateInfo) console.error("date-info element not found");
    if (!imageGrid) console.error("image-grid element not found");
    if (!imageUploadInput) console.error("image-upload input not found");
    if (!addImageBtn) console.error("add-image-btn not found");

    // Exit if critical elements are missing
    if (!imageUploadInput || !addImageBtn) {
      alert("Error: Required elements for image upload are missing. Check the console for details.");
      return;
    }

    // Set the current date (e.g., "July 2020")
    const currentDate = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[currentDate.getMonth()];
    const year = currentDate.getFullYear();

    // Function to update the date info element with the current month, year, and image count
    const updateDateInfo = () => {
      const imageCount = uploadedImages.length;
      dateInfo.textContent = `${month} ${year} ${imageCount} photos`;
    };

    // Function to render images in the grid with delete buttons
    const renderImages = () => {
      imageGrid.innerHTML = ""; // Clear the grid
      uploadedImages.forEach((imageObj, index) => {
        const imageContainer = document.createElement("div");
        imageContainer.className = "image-container";
        const img = document.createElement("img");
        img.src = imageObj.dataUrl;
        imageContainer.appendChild(img);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "delete-btn";
        deleteBtn.addEventListener("click", () => {
          console.log(`Deleting image at index ${index}`);
          // Remove image from the array
          uploadedImages.splice(index, 1);
          // Recompute image paths as "image-0.jpg", "image-1.jpg", etc.
          uploadedImages = uploadedImages.map((imgObj, idx) => ({
            path: `image-${idx}.jpg`,
            dataUrl: imgObj.dataUrl
          }));
          localStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));
          renderImages();

          // Clear categorization data since the images have changed
          localStorage.removeItem("cl_dict");
          localStorage.removeItem("img_dict");
          localStorage.removeItem("image_paths");
        });
        imageContainer.appendChild(deleteBtn);
        imageGrid.appendChild(imageContainer);

        // Add a zoom effect on hover
        img.addEventListener("mouseover", () => {
          img.style.transform = "scale(1.1)";
          img.style.transition = "transform 0.3s ease";
        });
        img.addEventListener("mouseout", () => {
          img.style.transform = "scale(1)";
        });

        // Click to view the full image (see viewFullImage below)
        img.addEventListener("click", () => {
          viewFullImage(imageObj.dataUrl);
        });
      });
      updateDateInfo();
    };

    // Trigger file input when the add button is clicked
    addImageBtn.addEventListener("click", () => {
      console.log("Add image button clicked");
      imageUploadInput.click();
    });

    // Handle image upload
    imageUploadInput.addEventListener("change", (event) => {
      console.log("Image upload input changed");
      const files = event.target.files;
      if (files && files.length > 0) {
        console.log(`Uploading ${files.length} images`);
        const newImageObjs = [];
        const promises = Array.from(files).map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              newImageObjs.push({
                path: "", // Temporary; will be set when processed
                dataUrl: e.target.result
              });
              resolve();
            };
            reader.readAsDataURL(file);
          });
        });
        Promise.all(promises).then(() => {
          // Append new images to the existing list, then update image paths
          uploadedImages.push(...newImageObjs);
          uploadedImages = uploadedImages.map((imgObj, idx) => ({
            path: `image-${idx}.jpg`,
            dataUrl: imgObj.dataUrl
          }));
          localStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));
          console.log(`Total images in localStorage: ${uploadedImages.length}`);
          // Clear categorization data because images have been updated
          localStorage.removeItem("cl_dict");
          localStorage.removeItem("img_dict");
          localStorage.removeItem("image_paths");
          renderImages();
        }).catch(error => {
          console.error("Error processing uploaded images:", error);
          alert("Failed to process uploaded images. Check the console for details.");
        });
      } else {
        console.log("No files selected");
      }
    });

    // Initial render
    renderImages();
  };

  // ------------------------------------------------------------------------
  // Function to send images to server for categorization
  // ------------------------------------------------------------------------
  const processImagesInColab = async () => {
    console.log("Starting processImagesInColab");
    const uploadedImages = JSON.parse(localStorage.getItem("uploadedImages")) || [];
    console.log(`Found ${uploadedImages.length} images to process`);
    if (uploadedImages.length === 0) {
      console.warn("No images to process");
      return { error: "No images to process" };
    }

    console.log("Converting data URLs to files");
    const files = await Promise.all(uploadedImages.map(async (imageObj, index) => {
      try {
        console.log(`Converting image ${index + 1}/${uploadedImages.length}`);
        const response = await fetch(imageObj.dataUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch data URL for image ${index}: ${response.statusText}`);
        }
        const blob = await response.blob();
        const file = new File([blob], `image-${index}.jpg`, { type: "image/jpeg" });
        console.log(`Converted image ${index + 1}: ${file.name}, size: ${file.size} bytes`);
        return file;
      } catch (error) {
        console.error(`Error converting data URL to file at index ${index}:`, error);
        throw error;
      }
    }));
    console.log(`Successfully converted ${files.length} files`);

    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append("images", file);
      console.log(`Added file ${index + 1} to FormData: ${file.name}`);
    });

    // Update to your Flask endpoint if needed (ngrok not required)
    const uploadUrl = "/upload";
    console.log(`Sending images to server at ${uploadUrl}`);

    // Retry logic for fetch requests
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        console.log(`Fetch attempt ${attempt + 1}/${maxRetries}`);
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: formData
        });
        console.log(`Response status: ${response.status}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
          throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
        }
        const data = await response.json();
        console.log("Parsed response from server:", data);
        if (data.error) {
          console.error("Server returned an error:", data.error);
          throw new Error(data.error);
        }
        return data;
      } catch (error) {
        attempt++;
        if (attempt === maxRetries) {
          console.error("Max retries reached. Failed to process images:", error);
          throw error;
        }
        console.warn(`Attempt ${attempt}/${maxRetries} failed. Retrying in 2 seconds...`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  // ------------------------------------------------------------------------
  // Function for the Categories page: Render categorized images
  // ------------------------------------------------------------------------
  const initCategoriesPage = () => {
    console.log("Initializing Categories Page");
    const categoriesSection = document.getElementById("categories-section");
    const searchInput = document.getElementById("category-search-input");
    const searchButton = document.getElementById("category-search-button");

    if (!categoriesSection) {
      console.error("categories-section element not found");
      alert("Error: categories-section element not found. Check the HTML structure.");
      return;
    }

    // Function to show a loading indicator
    const showLoading = () => {
      console.log("Showing loading message");
      categoriesSection.innerHTML = "<p>Processing...</p>";
    };

    // Function to render categories, optionally filtered by a search string
    const renderCategories = (filter = "") => {
      console.log("Rendering categories");
      const img_dict = JSON.parse(localStorage.getItem("img_dict")) || {};
      const cl_dict = JSON.parse(localStorage.getItem("cl_dict")) || {};
      const image_paths = JSON.parse(localStorage.getItem("image_paths")) || [];
      const uploadedImages = JSON.parse(localStorage.getItem("uploadedImages")) || [];
      console.log("cl_dict:", cl_dict);
      console.log("img_dict:", img_dict);
      console.log("image_paths:", image_paths);
      console.log("uploadedImages:", uploadedImages);

      // Create a mapping from image paths to data URLs
      const pathToDataUrl = {};
      uploadedImages.forEach((imageObj) => {
        pathToDataUrl[imageObj.path] = imageObj.dataUrl;
      });
      console.log("pathToDataUrl mapping:", pathToDataUrl);
      categoriesSection.innerHTML = ""; // Clear the section

      // Show a message if no categories are available
      if (Object.keys(cl_dict).length === 0) {
        console.warn("No categories available");
        const noDataMessage = document.createElement("p");
        noDataMessage.textContent = "No categories available. Please upload images on the All Images page.";
        categoriesSection.appendChild(noDataMessage);
        return;
      }

      // Iterate over each cluster in cl_dict to display the categorized images
      Object.keys(cl_dict).forEach((clusterId) => {
        const categoryName = cl_dict[clusterId].toUpperCase();
        console.log(`Processing cluster ${clusterId}: ${categoryName}`);

        // Filter categories based on search input
        if (filter && !categoryName.includes(filter.toUpperCase())) {
          return;
        }

        // Create DOM elements for this category
        const categorySection = document.createElement("div");
        const categoryTitle = document.createElement("h2");
        categoryTitle.textContent = categoryName;
        categoryTitle.style.color = "#3599db";
        const categoryGrid = document.createElement("div");
        categoryGrid.className = "image-grid";

        // Find images in this category
        let imageCount = 0;
        Object.keys(img_dict).forEach((imagePath) => {
          if (img_dict[imagePath] == clusterId) {
            const dataUrl = pathToDataUrl[imagePath];
            if (dataUrl) {
              const img = document.createElement("img");
              img.src = dataUrl;
              categoryGrid.appendChild(img);
              imageCount++;
              // Zoom effect on hover
              img.addEventListener("mouseover", () => {
                img.style.transform = "scale(1.1)";
                img.style.transition = "transform 0.4s ease";
              });
              img.addEventListener("mouseout", () => {
                img.style.transform = "scale(1)";
              });
              // Click to view full image
              img.addEventListener("click", () => {
                viewFullImage(dataUrl);
              });
            } else {
              console.warn(`No dataURL found for image path ${imagePath} in cluster ${clusterId}`);
            }
          }
        });
        console.log(`Cluster ${clusterId} (${categoryName}) has ${imageCount} images`);

        // Only add the category if there are images to display
        if (categoryGrid.children.length > 0) {
          categorySection.appendChild(categoryTitle);
          categorySection.appendChild(categoryGrid);
          categoriesSection.appendChild(categorySection);
        } else {
          console.log(`Cluster ${clusterId} (${categoryName}) has no images to display`);
        }
      });
    };

    // Show the "Processing..." message immediately
    showLoading();

    // Check if images have already been processed
    const storedCL = JSON.parse(localStorage.getItem("cl_dict"));
    if (storedCL && Object.keys(storedCL).length > 0) {
      console.log("Images already processed, rendering categories");
      renderCategories();
    } else {
      console.log("Images not processed yet, sending to server");
      processImagesInColab().then(data => {
        if (data.error) {
          console.error("Error from processImagesInColab:", data.error);
          categoriesSection.innerHTML = `<p>Error: ${data.error}</p>`;
          return;
        }
        // Save results in localStorage
        localStorage.setItem("cl_dict", JSON.stringify(data.cl_dict));
        localStorage.setItem("img_dict", JSON.stringify(data.img_dict));
        localStorage.setItem("image_paths", JSON.stringify(data.image_paths));
        console.log("Stored results in localStorage");
        renderCategories();
      }).catch(error => {
        console.error("Error processing images on the server:", error);
        categoriesSection.innerHTML = "<p>Failed to process images. Please check the server and try again.</p>";
      });
    }

    // Add event listeners for search
    searchButton.addEventListener("click", () => {
      const filter = searchInput.value.trim();
      renderCategories(filter);
    });
    searchInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        const filter = searchInput.value.trim();
        renderCategories(filter);
      }
    });
  };

  // ------------------------------------------------------------------------
  // Function to view the full image in an overlay
  // ------------------------------------------------------------------------
  const viewFullImage = (dataUrl) => {
    const fullImageViewer = document.createElement("div");
    fullImageViewer.style.position = "fixed";
    fullImageViewer.style.top = "0";
    fullImageViewer.style.left = "0";
    fullImageViewer.style.width = "100%";
    fullImageViewer.style.height = "100%";
    fullImageViewer.style.backgroundColor = "rgba(0,0,0,0.8)";
    fullImageViewer.style.display = "flex";
    fullImageViewer.style.justifyContent = "center";
    fullImageViewer.style.alignItems = "center";
    fullImageViewer.style.zIndex = "1000";
    const fullImage = document.createElement("img");
    fullImage.src = dataUrl;
    fullImage.style.maxWidth = "90%";
    fullImage.style.maxHeight = "90%";
    fullImageViewer.appendChild(fullImage);
    fullImageViewer.addEventListener("click", () => {
      document.body.removeChild(fullImageViewer);
    });
    document.body.appendChild(fullImageViewer);
  };

  // ------------------------------------------------------------------------
  // Initialize the appropriate functionality based on the current page
  // ------------------------------------------------------------------------
  if (isIndexPage) {
    console.log("Initializing Index Page");
    initAllImagesPage();
  } else if (isCategoriesPage) {
    console.log("Initializing Categories Page");
    initCategoriesPage();
  } else {
    console.error("Unknown page. This script should be used on index.html or categories.html.");
  }
});
