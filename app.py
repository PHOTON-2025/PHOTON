# Install dependencies
!pip install flask flask-ngrok pyngrok flask-cors
!pip install torch transformers sentence-transformers scikit-learn matplotlib pillow numpy



# Import libraries
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import shutil
from werkzeug.utils import secure_filename
import zipfile
import torch
import shutil
import kagglehub
from PIL import Image
import requests
import os
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import warnings
from itertools import combinations
from transformers import AutoProcessor, AutoModelForImageTextToText
from sentence_transformers import SentenceTransformer
from transformers import pipeline

# Flask setup
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


# Temporary folder for uploaded images
UPLOAD_FOLDER = "/content/uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Your ML model code
# Define global variables
loc = None
img_dict = None
cl_dict = None
captions = None
vectors = None
encoding_vectors = None
labels = None

# Reset global variables
def reset_variables():
    global loc
    global img_dict
    global cl_dict
    global captions
    global vectors
    global encoding_vectors
    global labels
    loc = None
    img_dict = None
    cl_dict = None
    captions = None
    vectors = None
    encoding_vectors = None
    labels = None

# SETTING UP THE MODELS
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
processor_cap = AutoProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model_cap = AutoModelForImageTextToText.from_pretrained("Salesforce/blip-image-captioning-base")
model_cap.to(device, dtype=torch.float16)
model_enc = SentenceTransformer('distilbert-base-nli-mean-tokens')
model_enc.to(device, dtype=torch.float16)
unmasker = pipeline('fill-mask', model='bert-base-uncased')
warnings.filterwarnings("ignore", message="You seem to be using the pipelines sequentially on GPU.*")

# DEFINING FUNCTIONS
def caption_images_in_folder(folder_path):
    global captions
    captions_dict = {}
    text = "a detailed image of"
    for filename in os.listdir(folder_path):
        if filename.endswith((".jpg", ".jpeg", ".png")):
            image_path = os.path.join(folder_path, filename)
            image = Image.open(image_path).convert('RGB')
            inputs = processor_cap(image, text, return_tensors="pt").to(device, dtype=torch.float32)
            generated_ids = model_cap.generate(**inputs)
            caption = processor_cap.decode(generated_ids[0], skip_special_tokens=True)
            captions_dict[image_path] = caption
    captions = captions_dict
    return captions_dict

def caption_images_in_folder_simple1(folder_path):
    captions_dict = {}
    text = "a photograph of"
    for im_path in folder_path:
        image_path = im_path
        image = Image.open(image_path).convert('RGB')
        inputs = processor_cap(image, text, return_tensors="pt").to(device, dtype=torch.float32)
        generated_ids = model_cap.generate(**inputs)
        caption = processor_cap.decode(generated_ids[0], skip_special_tokens=True)
        captions_dict[image_path] = caption
    return captions_dict

def caption_images_in_folder_simple2(folder_path):
    captions_dict = {}
    text = "A close-up shot of"
    for im_path in folder_path:
        image_path = im_path
        image = Image.open(image_path).convert('RGB')
        inputs = processor_cap(image, text, return_tensors="pt").to(device, dtype=torch.float32)
        generated_ids = model_cap.generate(**inputs)
        caption = processor_cap.decode(generated_ids[0], skip_special_tokens=True)
        captions_dict[image_path] = caption
    return captions_dict

def caption_images_in_folder_simple3(folder_path):
    captions_dict = {}
    text = "A high-resolution image of"
    for im_path in folder_path:
        image_path = im_path
        image = Image.open(image_path).convert('RGB')
        inputs = processor_cap(image, text, return_tensors="pt").to(device, dtype=torch.float32)
        generated_ids = model_cap.generate(**inputs)
        caption = processor_cap.decode(generated_ids[0], skip_special_tokens=True)
        captions_dict[image_path] = caption
    return captions_dict

def caption_images_in_folder_simple4(folder_path):
    captions_dict = {}
    text = "An artistic rendering of"
    for im_path in folder_path:
        image_path = im_path
        image = Image.open(image_path).convert('RGB')
        inputs = processor_cap(image, text, return_tensors="pt").to(device, dtype=torch.float32)
        generated_ids = model_cap.generate(**inputs)
        caption = processor_cap.decode(generated_ids[0], skip_special_tokens=True)
        captions_dict[image_path] = caption
    return captions_dict

def caption_to_vectors(captions):
    global vectors
    vectors_dict = {}
    for i in captions:
        encoding = model_enc.encode(captions[i])
        vectors_dict[i] = encoding
    vectors = vectors_dict
    return vectors_dict

def locations_captions_for_labels(label_index):
    global encoding_vectors
    global labels
    global loc
    locations = []
    for vector, label in zip(encoding_vectors, labels):
        if label == label_index:
            for loc in vectors:
                if (vectors[loc] == vector).all():
                    locations.append(loc)
    loc = locations
    return locations

def display_images_grid(image_paths, grid_size=(2, 2)):
    fig, axes = plt.subplots(grid_size[0], grid_size[1], figsize=(10, 10))
    for ax, path in zip(axes.flat, image_paths):
        img = mpimg.imread(path)
        ax.imshow(img)
        ax.axis('off')
    plt.tight_layout()
    plt.show()

def get_label(index):
    label = "[MASK]"
    scores = []
    caption_base, loc = create_caption_base(index)
    max_cap_len = len(caption_base[index]['captions_simple0'])
    for length in range(max_cap_len + 1):
        temp_cap = caption_base[index]['captions_simple0'][:length]
        temp_cap = [item.replace('a detailed image of ', '') for item in temp_cap]
        prompt = f'cluster = {temp_cap}\nlabel = ["{label}"]'
        feature = unmasker(prompt)
        scores.append([feature[0]['score'], feature[0]['token_str']])

        temp_cap = caption_base[index]['captions_simple1'][:length]
        temp_cap = [item.replace('a photograph of ', '') for item in temp_cap]
        prompt = f'cluster = {temp_cap}\nlabel = ["{label}"]'
        feature = unmasker(prompt)
        scores.append([feature[0]['score'], feature[0]['token_str']])

        temp_cap = caption_base[index]['captions_simple2'][:length]
        temp_cap = [item.replace('a close - up shot of', '') for item in temp_cap]
        prompt = f'cluster = {temp_cap}\nlabel = ["{label}"]'
        feature = unmasker(prompt)
        scores.append([feature[0]['score'], feature[0]['token_str']])

        temp_cap = caption_base[index]['captions_simple3'][:length]
        temp_cap = [item.replace('a high - resolution image of', '') for item in temp_cap]
        prompt = f'cluster = {temp_cap}\nlabel = ["{label}"]'
        feature = unmasker(prompt)
        scores.append([feature[0]['score'], feature[0]['token_str']])

        temp_cap = caption_base[index]['captions_simple4'][:length]
        temp_cap = [item.replace('an artistic rendering of', '') for item in temp_cap]
        prompt = f'cluster = {temp_cap}\nlabel = ["{label}"]'
        feature = unmasker(prompt)
        scores.append([feature[0]['score'], feature[0]['token_str']])

    scores.sort(reverse=True)
    scores = scores[:10]
    list1 = [i[1] for i in scores]
    list2 = [captions[i] for i in loc]
    list2 = [item.replace('a detailed image of ', '') for item in list2]
    similarity_matrix = compute_similarity_matrix(list1, list2, batch_size=16)

    max_index = np.unravel_index(np.argmax(similarity_matrix, axis=None), similarity_matrix.shape)
    max_value = similarity_matrix[max_index]
    token_string = list1[max_index[0]]

    if max_value >= 0.6:
        return token_string
    else:
        multi_label = get_multi_label(list2)
        return str(multi_label)

def create_caption_base(index):
    global loc
    caption_base = {}
    captions_simple0 = []
    captions_simple1 = []
    captions_simple2 = []
    captions_simple3 = []
    captions_simple4 = []
    loc = locations_captions_for_labels(label_index=index)
    loca = loc[:10]
    for i in loca:
        captions_simple0.append(captions[i])
    captions_simple1_dict = caption_images_in_folder_simple1(loca)
    captions_simple2_dict = caption_images_in_folder_simple2(loca)
    captions_simple3_dict = caption_images_in_folder_simple3(loca)
    captions_simple4_dict = caption_images_in_folder_simple4(loca)
    for i in loca:
        captions_simple1.append(captions_simple1_dict[i])
    for i in loca:
        captions_simple2.append(captions_simple2_dict[i])
    for i in loca:
        captions_simple3.append(captions_simple3_dict[i])
    for i in loca:
        captions_simple4.append(captions_simple4_dict[i])
    caption_base[index] = {
        'captions_simple0': captions_simple0,
        'captions_simple1': captions_simple1,
        'captions_simple2': captions_simple2,
        'captions_simple3': captions_simple3,
        'captions_simple4': captions_simple4
    }
    return caption_base, loc

def get_multi_label(sentence_list):
    for sentence in sentence_list:
        words = sentence.split()
        sentence_encoding = model_enc.encode(sentence)
        similarities = []
        for word in words:
            word_encoding = model_enc.encode(word)
            similarity = np.dot(sentence_encoding, word_encoding.T) / (np.linalg.norm(sentence_encoding) * np.linalg.norm(word_encoding))
            similarities.append(similarity)

        similarities = ((similarities - min(similarities)) / (max(similarities) - min(similarities))) * 9 + 1
        similarities_list = similarities.tolist()
        labels = []
        for i in similarities_list:
            if i >= 5:
                labels.append(words[similarities_list.index(i)])

    unique_labels = list(dict.fromkeys(labels))
    return labels

def compute_similarity_matrix(L1, L2, batch_size=16):
    similarity_matrix = []
    for i in range(0, len(L1), batch_size):
        batch_L1 = L1[i:i + batch_size]
        embeddings_L1 = encode_texts(batch_L1)
        embeddings_L1_np = np.array(embeddings_L1)
        embeddings_L2 = encode_texts(L2)
        embeddings_L2_np = np.array(embeddings_L2)
        batch_similarity = cosine_similarity(embeddings_L1_np, embeddings_L2_np)
        similarity_matrix.extend(batch_similarity)
    return np.array(similarity_matrix)

def encode_texts(texts):
    embeddings = []
    for text in texts:
        embedding = model_enc.encode(text)
        embeddings.append(embedding)
    return embeddings

def process():
    global cl_dict
    global img_dict
    global captions
    global vectors
    global encoding_vectors
    global labels
    folder_path = "/content/uploads"  # Use the uploads folder in Colab
    captions = caption_images_in_folder(folder_path)
    vectors = caption_to_vectors(captions)
    encoding_vectors = [vectors[i] for i in vectors]
    dbscan = DBSCAN(eps=0.1, min_samples=1, metric='euclidean')
    labels = dbscan.fit_predict(encoding_vectors)

    cl_dict = {}
    for i in range(min(labels), max(labels) + 1):
        lab = get_label(i)
        cl_dict[i] = lab

    img_dict={}
    for loc in enumerate(captions):
      #print(loc[1],labels[loc[0]])
      num=np.int64(labels[(loc[0])]).item()
      name=loc[1].replace('/content/uploads/', '')
      img_dict[name]=num

    return cl_dict, img_dict




import os
import shutil
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

# Create your Flask app instance
app = Flask(__name__)

# Configure the upload folder path
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Dummy globals for demonstration purposes.
# In your real use-case, these should be set by your ML processing.
cl_dict = {}
img_dict = {}

# -------------------------------------------------------------------------
# Route to serve the landing page (index.html)
# -------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")

# -------------------------------------------------------------------------
# Route to serve the All Images page (allimages.html)
# -------------------------------------------------------------------------
@app.route("/all_images")
def all_images():
    return render_template("allimages.html")

# -------------------------------------------------------------------------
# Route to serve the Categories page (categories.html)
# -------------------------------------------------------------------------
@app.route("/categories")
def categories():
    return render_template("categories.html")

# -------------------------------------------------------------------------
# Optional API route to return JSON (for testing)
# -------------------------------------------------------------------------
@app.route("/api/home")
def home_test():
    return jsonify({"cl_dict": cl_dict, "img_dict": img_dict}), 200

# -------------------------------------------------------------------------
# Route to handle image uploads and run the ML categorization.
# -------------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload_images():
    # Clear the uploads folder before processing new images
    if os.path.exists(app.config["UPLOAD_FOLDER"]):
        shutil.rmtree(app.config["UPLOAD_FOLDER"])
    os.makedirs(app.config["UPLOAD_FOLDER"])

    # Handle multiple image uploads
    if "images" not in request.files:
        return jsonify({"error": "No images provided"}), 400

    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No images provided"}), 400

    # Save each uploaded image to the uploads folder
    image_paths = []
    for file in files:
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(file_path)
            image_paths.append(file_path)

    # Run the ML model for image categorization.
    # Assume process() is a function that returns (cl_dict, img_dict)
    try:
        cl_dict, img_dict = process()  # Make sure process() is imported/defined.
        return jsonify({
            "cl_dict": cl_dict,
            "img_dict": img_dict,
            "image_paths": image_paths
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500



from pyngrok import ngrok

# Set the ngrok authtoken (your provided token)
get_ipython().system('ngrok authtoken 2UFfKWMWbMuAC3aMQ8NN9ree3ib_6EjAy5T5V3kg8fR2Ce6gN')

# Set up the ngrok tunnel on port 3000
public_url = ngrok.connect(3000)
print('Public URL:', public_url)

# --- Run the Flask App on Port 3000 ---
app.run(port=3000)




#if __name__ == '__main__':
#    app.run(debug=True)
