const prisma=require("../config/prisma");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const {jwtSecret}=require("../config/env");
const sign=u=>jwt.sign({sub:u.id,role:u.role},jwtSecret,{expiresIn:"1h"});
async function register(req,res){
  const {name,email,password}=req.body;
  if(!name||!email||!password||password.length<8) return res.status(400).json({error:"name, email and password>=8 required"});
  if(await prisma.user.findUnique({where:{email}})) return res.status(409).json({error:"Email already registered"});
  const passwordHash=await bcrypt.hash(password,10);
  const user=await prisma.user.create({data:{name,email,passwordHash}});
  res.status(201).json({accessToken:sign(user),user:{id:user.id,email:user.email,role:user.role}});
}
async function login(req,res){
  const {email,password}=req.body; const user=await prisma.user.findUnique({where:{email}});
  if(!user||!(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({error:"Invalid credentials"});
  res.json({accessToken:sign(user),user:{id:user.id,email:user.email,role:user.role}});
}
async function me(req,res){ const u=await prisma.user.findUnique({where:{id:req.user.sub},select:{id:true,name:true,email:true,role:true,createdAt:true}}); res.json(u); }
module.exports={register,login,me};
