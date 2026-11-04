
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB
const client = new MongoClient(process.env.MONGODB_URL);

async function connectToMongoDB() {
  try {
    await client.connect();

    console.log("You successfully connected to MongoDB!");

    const database = client.db("wanderlast");
    const destinationCollection = database.collection("destinations");

    // POST Destination
    app.post("/add-destination", async (req, res) => {
      try {
        console.log("POST API is called");

        const destination = req.body;
        console.log(destination)
        

        const result = await destinationCollection.insertOne({
          ...destination,
          createdAt: new Date(),
          
        });
       

        res.status(201).send({
          success: true,
          message: "Destination added successfully",
          insertedId: result.insertedId,
        
        });

      } catch (error) {
        console.error("Insert Error:", error);

        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET Test Route
    app.get("/", (req, res) => {
      res.send({
        message: "WanderLast Server is Running!",
      });
    });

    app.get('/destination',async(req,res)=>{
        const result = await destinationCollection.find().toArray()
       res.send(result)
    })

   app.get('/destination/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid Destination ID"
            });
        }

        const result = await destinationCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!result) {
            return res.status(404).send({
                success: false,
                message: "Destination not found"
            });
        }

        res.send(result);

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
});

app.patch('/destination/:id',async (req,res)=>{
  const{id}= req.params
  const Updatedata= req.body
  const result = await destinationCollection.updateOne({
    _id:new ObjectId(id)
  },
{$set:Updatedata})
res.json(result)

})



    // Start Server
    app.listen(PORT, () => {
      console.log(`Server is running at port ${PORT}`);
    });

  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
  }
}

connectToMongoDB();
