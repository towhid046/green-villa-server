const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://green-villla.web.app",
      "https://green-villla.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("GreenVilla Server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q1nysvk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify token:
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send("Unauthorized");
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send("Unauthorized");
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const estateCollection = client.db("greenVillaDB").collection("estates");
    const newsCollection = client.db("greenVillaDB").collection("news");
    const reviewCollection = client.db("greenVillaDB").collection("reviews");

    // token related api:
    app.post("/jwt", async (req, res) => {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, process.env.TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // clear cookie
    app.get("/logout", async (req, res) => {
      res.clearCookie("token", {
        path: "/",
        maxAge: 10,
      });
      res.redirect("/");
    });

    // get all estates data:
    app.get("/estates", async (req, res) => {
      const query = req.query;
      const page = Number(req.query?.page);
      const size = Number(req.query?.size);

      const cursor = estateCollection
        .find()
        .skip(page * size)
        .limit(size);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get a single estate data:
    app.get("/estates/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await estateCollection.findOne(query);
      res.send(result);
    });

    // get all estate numbers
    app.get("/estates-count", async (req, res) => {
      const count = await estateCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // get all estates data of a specific user:
    app.get("/user-estates", verifyToken, async (req, res) => {
      if (req.query.email !== req.user.loggedUser) {
        return res.status(403).send("Forbidden Access");
      }
      const email = req.query?.email;
      let filter = {};
      if (email) {
        filter = { email: email };
      }
      const options = {
        projection: { image: 1, estate_title: 1, status: 1, email: 1 },
      };
      const result = await estateCollection.find(filter, options).toArray();
      res.send(result);
    });

    // get all news data
    app.get("/news", async (req, res) => {
      const cursor = newsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // get a single news data:
    app.get("/news/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newsCollection.findOne(query);
      res.send(result);
    });

    // get all reviews data:
    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // add a new estate
    app.post("/estates", async (req, res) => {
      const estate = req.body;
      const estateDoc = { ...estate };
      const result = await estateCollection.insertOne(estateDoc);
      res.send(result);
    });

    // get user cart data:
    app.post("/estateIds", async (req, res) => {
      const estateIds = req.body;
      const estateId = estateIds.map((id) => new ObjectId(id));
      const query = {
        _id: { $in: estateId },
      };
      const result = await estateCollection.find(query).toArray();
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`GreenVilla is running on PORT: ${port}`);
});
