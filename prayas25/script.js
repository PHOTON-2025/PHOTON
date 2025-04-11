document.addEventListener("DOMContentLoaded", () => {
    // Determine the current page
    const isIndexPage = window.location.pathname.includes("allimages.html") || window.location.pathname === "/";
    const isCategoriesPage = window.location.pathname.includes("categories.html");

    // Common variables
    let uploadedImages = JSON.parse(localStorage.getItem("uploadedImages")) || [];

    // Function for index.html: Handle image uploads, rendering, and deletion
    const initIndexPage = () => {
        // Debugging: Check if DOM elements are found
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

        // Function to update the date and image count
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
                    uploadedImages.splice(index, 1); // Remove the image from the array
                    // Recompute paths for remaining images
                    uploadedImages = uploadedImages.map((imgObj, idx) => ({
                        path: `image-${idx}.jpg`,
                        dataUrl: imgObj.dataUrl
                    }));
                    localStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));
                    renderImages(); // Re-render the grid
                    // Clear categorization data since the images have changed
                    localStorage.removeItem("cl_dict");
                    localStorage.removeItem("img_dict");
                    localStorage.removeItem("image_paths");
                });
                imageContainer.appendChild(deleteBtn);

                imageGrid.appendChild(imageContainer);

                // Add zoom effect on hover
                img.addEventListener("mouseover", () => {
                    img.style.transform = "scale(1.1)";
                    img.style.transition = "transform 0.3s ease";
                });
                img.addEventListener("mouseout", () => {
                    img.style.transform = "scale(1)";
                });

                // Add click to view full image
                img.addEventListener("click", () => {
                    viewFullImage(imageObj.dataUrl);
                });
            });
            updateDateInfo(); // Update the image count
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
                // Convert files to data URLs and append them
                const newImageObjs = [];
                const promises = Array.from(files).map(file => {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            newImageObjs.push({
                                path: "", // Will be set after all images are processed
                                dataUrl: e.target.result
                            });
                            resolve();
                        };
                        reader.readAsDataURL(file);
                    });
                });

                Promise.all(promises).then(() => {
                    // Append new images to the existing list
                    uploadedImages.push(...newImageObjs);
                    // Assign paths in the format image-X.jpg
                    uploadedImages = uploadedImages.map((imgObj, idx) => ({
                        path: `image-${idx}.jpg`,
                        dataUrl: imgObj.dataUrl
                    }));
                    localStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));
                    console.log(`Total images in localStorage: ${uploadedImages.length}`);

                    // Clear categorization data since new images have been added
                    localStorage.removeItem("cl_dict");
                    localStorage.removeItem("img_dict");
                    localStorage.removeItem("image_paths");

                    // Re-render the grid
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

    // Function to send images to Colab and get categorization results
    const processImagesInColab = async () => {
        console.log("Starting processImagesInColab");
        // Get the images from localStorage
        const uploadedImages = JSON.parse(localStorage.getItem("uploadedImages")) || [];
        console.log(`Found ${uploadedImages.length} images to process`);

        if (uploadedImages.length === 0) {
            console.warn("No images to process");
            return { error: "No images to process" };
        }

        // Convert data URLs back to files
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

        // Send images to the Flask server in Colab
        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append("images", file);
            console.log(`Added file ${index + 1} to FormData: ${file.name}`);
        });

        // Use the corrected ngrok URL
        const colabUrl = "https://3525-34-16-182-120.ngrok-free.app/upload";
        console.log(`Sending images to Colab server at ${colabUrl}`);

        // Retry logic for fetching
        const maxRetries = 3;
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                console.log(`Fetch attempt ${attempt + 1}/${maxRetries}`);
                const response = await fetch(colabUrl, {
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
                console.log("Parsed response from Colab:", data);
                if (data.error) {
                    console.error("Colab server returned an error:", data.error);
                    throw new Error(data.error);
                }
                return data; // Success
            } catch (error) {
                attempt++;
                if (attempt === maxRetries) {
                    console.error("Max retries reached. Failed to process images:", error);
                    throw error; // Max retries reached
                }
                console.warn(`Attempt ${attempt}/${maxRetries} failed. Retrying in 2 seconds...`, error);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
            }
        }
    };

    // Function for categories.html: Render categorized images
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

        // Function to render categories
        const renderCategories = (filter = "") => {
            console.log("Rendering categories");
            // Load data from localStorage
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

            categoriesSection.innerHTML = ""; // Clear the section (removes the "Processing..." message)

            // Check if there are any categories to display
            if (Object.keys(cl_dict).length === 0) {
                console.warn("No categories available");
                const noDataMessage = document.createElement("p");
                noDataMessage.textContent = "No categories available. Please upload images on the All Images page.";
                categoriesSection.appendChild(noDataMessage);
                return;
            }

            // Iterate over each cluster in cl_dict
            Object.keys(cl_dict).forEach((clusterId) => {
                const categoryName = cl_dict[clusterId].toUpperCase(); // Convert to uppercase for display(labels)
                console.log(`Processing cluster ${clusterId}: ${categoryName}`);

                // Filter categories based on search input
                if (filter && !categoryName.includes(filter.toUpperCase())) {
                    return; // Skip this category if it doesn't match the filter
                }

                // Create category section
                const categorySection = document.createElement("div");
                const categoryTitle = document.createElement("h2");
                categoryTitle.textContent = categoryName;
                categoryTitle.style.color = "#3599db";
                const categoryGrid = document.createElement("div");
                categoryGrid.className = "image-grid";

                // Find images in this cluster
                let imageCount = 0;
                Object.keys(img_dict).forEach((imagePath) => {
                    if (img_dict[imagePath] == clusterId) {
                        const dataUrl = pathToDataUrl[imagePath];
                        if (dataUrl) {
                            const img = document.createElement("img");
                            img.src = dataUrl;
                            categoryGrid.appendChild(img);
                            imageCount++;

                            // Add zoom effect on hover
                            img.addEventListener("mouseover", () => {
                                img.style.transform = "scale(1.1)";
                                img.style.transition = "transform 0.4s ease";
                            });
                            img.addEventListener("mouseout", () => {
                                img.style.transform = "scale(1)";
                            });

                            // Add click to view full image
                            img.addEventListener("click", () => {
                                viewFullImage(dataUrl);
                            });
                        } else {
                            console.warn(`No data URL found for image path ${imagePath} in cluster ${clusterId}`);
                        }
                    }
                });

                console.log(`Cluster ${clusterId} (${categoryName}) has ${imageCount} images`);

                // Only add the category if it has images
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
        const cl_dict = JSON.parse(localStorage.getItem("cl_dict"));
        if (cl_dict && Object.keys(cl_dict).length > 0) {
            console.log("Images already processed, rendering categories");
            renderCategories();
        } else {
            console.log("Images not processed yet, sending to Colab");
            // If not processed, send images to Colab
            processImagesInColab()
                .then(data => {
                    if (data.error) {
                        console.error("Error from processImagesInColab:", data.error);
                        categoriesSection.innerHTML = `<p>Error: ${data.error}</p>`;
                        return;
                    }

                    // Store the results in localStorage
                    localStorage.setItem("cl_dict", JSON.stringify(data.cl_dict));
                    localStorage.setItem("img_dict", JSON.stringify(data.img_dict));
                    localStorage.setItem("image_paths", JSON.stringify(data.image_paths));
                    console.log("Stored results in localStorage");

                    // Render the categories (this will clear the "Processing..." message)
                    renderCategories();
                })
                .catch(error => {
                    console.error("Error processing images in Colab:", error);
                    categoriesSection.innerHTML = "<p>Failed to process images. Please check the Colab server and try again.</p>";
                });
        }

        // Add event listener for search functionality
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

    // Function to view the full image
    const viewFullImage = (dataUrl) => {
        const fullImageViewer = document.createElement("div");
        fullImageViewer.style.position = "fixed";
        fullImageViewer.style.top = "0";
        fullImageViewer.style.left = "0";
        fullImageViewer.style.width = "100%";
        fullImageViewer.style.height = "100%";
        fullImageViewer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
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

    // Initialize the appropriate functionality based on the current page
    if (isIndexPage) {
        console.log("Initializing Index Page");
        initIndexPage();
    } else if (isCategoriesPage) {
        console.log("Initializing Categories Page");
        initCategoriesPage();
    } else {
        console.error("Unknown page. This script should be used on index.html or categories.html.");
    }
});